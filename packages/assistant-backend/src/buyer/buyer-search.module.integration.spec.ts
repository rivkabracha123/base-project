import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { AiHistoryEntity } from '../database/ai-history.entity';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import { UserProfileEntity } from '../database/user-profile.entity';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerModule } from './buyer.module';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { UnmatchedDemandDbStore } from './unmatched-demand.db-store';
import { InvalidLotsSearchRequestError } from './lots-service-search.client';

// Runtime wiring: the orchestrator the Nest container provides runs on the real LotsService and records demand in the database store.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  expectedExplainedResponse: { data: Array<{ lot: AuctionLot }> };
  scenarios: Array<{ name: string; criteria: BuyerCriteria }>;
};

const namedLot = contract.expectedExplainedResponse.data[0]!.lot;
const scenario = contract.scenarios.find((entry) => entry.name === 'canonical-english-category')!;

// Fake auction_lots repository returning the given lots for any query.
function lotsRepository(lots: AuctionLot[]) {
  const queryBuilder: Record<string, jest.Mock> = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn(async () => ({ entities: lots.map((payload) => ({ payload })), raw: [] })),
    getCount: jest.fn(async () => lots.length),
  };
  return { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) };
}

// Fake buyer_unmatched_demand repository: rows keyed by lead id, saved as plain JSON like jsonb.
function demandRepository() {
  const rows = new Map<string, BuyerUnmatchedDemandEntity>();
  return {
    rows,
    save: jest.fn(async (row: BuyerUnmatchedDemandEntity) => {
      rows.set(row.leadId, JSON.parse(JSON.stringify(row)));
      return row;
    }),
    delete: jest.fn(async ({ leadId }: { leadId: string }) => {
      rows.delete(leadId);
      return { affected: 1, raw: [] };
    }),
    findOneBy: jest.fn(async ({ leadId }: { leadId: string }) => rows.get(leadId) ?? null),
    find: jest.fn(async () => [...rows.values()]),
  };
}

// Compiles BuyerModule with the database repositories faked; profiles, AI history and seller leads are unused here.
async function compileBuyerModule(lots: AuctionLot[]) {
  const demand = demandRepository();
  const moduleRef = await Test.createTestingModule({
    // This test never calls the AI provider; uploads only need a writable storage path.
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ LOCAL_STORAGE_PATH: tmpdir() })] }), BuyerModule],
  })
    .overrideProvider(getRepositoryToken(AuctionLotEntity))
    .useValue(lotsRepository(lots))
    .overrideProvider(getRepositoryToken(BuyerUnmatchedDemandEntity))
    .useValue(demand)
    .overrideProvider(getRepositoryToken(UserProfileEntity))
    .useValue({})
    .overrideProvider(getRepositoryToken(AiHistoryEntity))
    .useValue({})
    .overrideProvider(getRepositoryToken(SellerLeadEntity))
    .useValue({})
    .compile();
  return {
    demand,
    orchestrator: moduleRef.get(BuyerSearchOrchestrator),
    demandStore: moduleRef.get(UnmatchedDemandDbStore),
  };
}

const input = {
  criteria: { ...scenario.criteria, price: { min: 500, max: 800, currency: 'USD' } },
  language: 'en' as const,
  leadId: 'buyer-lead-module-wiring',
  status: 'new',
  createdAt: '2026-10-07T09:00:00.000Z',
  searchedAt: '2026-10-07T09:01:00.000Z',
};

describe('BuyerModule search wiring', () => {
  it('records a no-result search in the database store staff read from, budget intact and without contact data', async () => {
    const { demand, orchestrator, demandStore } = await compileBuyerModule([]);

    const outcome = await orchestrator.search(input);

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(demand.save).toHaveBeenCalledTimes(1);
    expect(await demandStore.get(input.leadId)).toEqual(outcome.view);
    expect(outcome.view.unmatchedDemand.searchRequest.criteria.price).toEqual(input.criteria.price);
    expect(JSON.stringify([...demand.rows.values()])).not.toMatch(/email|phone|contact|conversation/);
  });

  it('returns the lots search result through the container and records no demand', async () => {
    const { demand, orchestrator } = await compileBuyerModule([namedLot]);

    const outcome = await orchestrator.search({ ...input, criteria: scenario.criteria });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    const ids = [...outcome.results.current, ...outcome.results.historical].map((entry) => entry.lot.id);
    expect(ids).toEqual([namedLot.id]);
    expect(demand.save).not.toHaveBeenCalled();
    // A lead with no earlier no-result demand has nothing to mark.
    expect(demand.findOneBy).toHaveBeenCalledWith({ leadId: input.leadId });
    expect(demand.delete).not.toHaveBeenCalled();
  });

  it('rejects input the lots search rules forbid before any query, and records no demand', async () => {
    const { demand, orchestrator } = await compileBuyerModule([namedLot]);

    const search = orchestrator.search({ ...input, criteria: { ...input.criteria, price: { min: -1, currency: 'USD' } } });

    await expect(search).rejects.toBeInstanceOf(InvalidLotsSearchRequestError);
    await expect(search).rejects.toMatchObject({ fields: ['filters.price.min'] });
    expect(demand.save).not.toHaveBeenCalled();
  });
});
