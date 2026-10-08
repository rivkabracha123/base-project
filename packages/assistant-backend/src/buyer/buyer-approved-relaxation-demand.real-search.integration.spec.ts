import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import type { Repository } from 'typeorm';
import type { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsService } from '../lots/lots.service';
import type { ApprovedRelaxation } from './approved-relaxation';
import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { toBuyerSearchStatusMessage } from './buyer-search-status-message';
import { BuyerSearchOrchestrator, type LotsSearchClient } from './buyer-search.orchestrator';
import type { SearchRequest } from './search-request';
import { UnmatchedDemandStore } from './unmatched-demand.store';

// Acceptance: one named fixture traced from buyer criteria through the real LotsService
// into the results hand-off or recorded staff demand, covering approved relaxation and the missing-criteria state.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedExplainedResponse: { data: Array<{ lot: AuctionLot }> };
  scenarios: Array<{ name: string; criteria: BuyerCriteria; language: 'en' | 'he' }>;
};

const namedLot = contract.expectedExplainedResponse.data[0]!.lot;
const namedPrice = namedLot.realizedPrice!.amount;
const approvedAt = '2026-10-06T10:00:00.000Z';

// Fake DB layer for the real LotsService: returns the named lot unless the price clause excludes it.
function fakeLotsRepository() {
  let priceParams: { priceMin?: number; priceMax?: number } = {};
  let count = 0;
  const queryBuilder: Record<string, jest.Mock> = {
    andWhere: jest.fn((clause: string, params?: Record<string, unknown>): unknown => {
      if (clause.includes('realizedPrice')) priceParams = params ?? {};
      return queryBuilder;
    }),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn(async () => {
      const inBudget =
        (priceParams.priceMin == null || namedPrice >= priceParams.priceMin) &&
        (priceParams.priceMax == null || namedPrice <= priceParams.priceMax);
      priceParams = {};
      const entities = inBudget ? [{ payload: namedLot }] : [];
      count = entities.length;
      return { entities, raw: [] };
    }),
    getCount: jest.fn(async () => count),
  };
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  } as unknown as Repository<AuctionLotEntity>;
  return { repository };
}

describe('Buyer search acceptance: named fixture through approved relaxation and demand capture', () => {
  const scenario = contract.scenarios.find((entry) => entry.name === 'canonical-english-category')!;
  // Buyer tightened the budget below the named lot's realized price in a correction turn.
  const tightBudget = { min: 500, max: namedPrice - 200, currency: 'USD' };
  const criteria: BuyerCriteria = { ...scenario.criteria, price: tightBudget };

  let demandStore: UnmatchedDemandStore;
  let searchRequests: SearchRequest[];
  let orchestrator: BuyerSearchOrchestrator;

  // Runs one search turn for the same lead, optionally with buyer-approved relaxations.
  const searchTurn = (approvedRelaxations?: ApprovedRelaxation[]) =>
    orchestrator.search({
      criteria,
      language: 'en',
      leadId: 'buyer-lead-relaxation-acceptance',
      status: 'new',
      createdAt: '2026-10-06T09:00:00.000Z',
      searchedAt: '2026-10-06T09:01:00.000Z',
      approvedRelaxations,
    });

  beforeEach(() => {
    const lotsService = new LotsService(fakeLotsRepository().repository);
    searchRequests = [];
    const lotsSearch: LotsSearchClient = {
      search: (request) => {
        searchRequests.push(request);
        return lotsService.search(request);
      },
    };
    demandStore = new UnmatchedDemandStore();
    orchestrator = new BuyerSearchOrchestrator(lotsSearch, undefined, demandStore);
  });

  it('records honest demand for staff when the strict budget finds nothing, and offers budget only behind approval', async () => {
    const outcome = await searchTurn();

    expect(searchRequests[0]?.filters?.price).toEqual(tightBudget);
    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.relaxationOptions).toContainEqual({ field: 'price', requiresApproval: true });
    expect(outcome.view.unmatchedDemand.demandSummary).toMatchObject({
      appliedCriteria: ['price', 'categories', 'creators'],
      recovery: 'no_relaxation_no_invention',
    });
    expect(demandStore.get('buyer-lead-relaxation-acceptance')).toEqual(outcome.view);
    expect(toBuyerSearchStatusMessage(outcome, { language: 'en', criteria }).speaker).toBe('no-results');
  });

  it('never relaxes the budget without approval, even when another filter is approved', async () => {
    const outcome = await searchTurn([{ field: 'creators', approvedAt }]);

    expect(searchRequests[0]?.filters?.price).toEqual(tightBudget);
    expect(searchRequests[0]?.filters?.creators).toBeUndefined();
    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.view.unmatchedDemand.demandSummary).toMatchObject({
      recovery: 'approved_relaxation_no_invention',
      relaxedFields: ['creators'],
    });
    expect(outcome.relaxationOptions.map((option) => option.field)).toEqual(['categories', 'price']);
  });

  it('hands the result cards the named lot once the buyer approves dropping the budget, without claiming it fits the budget', async () => {
    const outcome = await searchTurn([{ field: 'price', approvedAt }]);

    expect(searchRequests[0]?.filters?.price).toBeUndefined();
    expect(searchRequests[0]?.filters?.categories).toEqual(['rare_books']);
    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.approvedRefinements).toEqual(['price']);
    const handed = outcome.results.historical[0]!;
    expect(handed.lot).toEqual(namedLot);
    expect(handed.lot.id).toBe(contract.namedLotId);
    expect(handed.matchReasons.map((reason) => reason.field)).not.toContain('price');
    // The buyer's budget is still the recorded hard constraint for the next turn.
    expect(outcome.searchRequest.criteria.price).toEqual(tightBudget);
    expect(outcome.searchRequest.hardConstraints).toContainEqual(
      expect.objectContaining({ field: 'price', value: tightBudget }),
    );
  });

  it('sends the budget again on the next turn: an approval covers one search only', async () => {
    await searchTurn([{ field: 'price', approvedAt }]);
    const nextTurn = await searchTurn();

    expect(searchRequests[1]?.filters?.price).toEqual(tightBudget);
    expect(nextTurn.kind).toBe('unmatched');
  });

  it('does not call the lots search or record demand when the buyer has given nothing searchable yet', async () => {
    const outcome = await orchestrator.search({
      criteria: emptyBuyerCriteria('he'),
      language: 'he',
      leadId: 'buyer-lead-nothing-searchable',
      status: 'new',
      createdAt: '2026-10-06T09:00:00.000Z',
      searchedAt: '2026-10-06T09:01:00.000Z',
    });

    expect(outcome.kind).toBe('insufficient-criteria');
    expect(searchRequests).toEqual([]);
    expect(demandStore.list()).toEqual([]);
    expect(toBuyerSearchStatusMessage(outcome, { language: 'he' })).toEqual({
      speaker: 'needs-criteria',
      text: 'לחיפוש נדרש לפחות פרט אחד, כמו קטגוריה, יוצר או תקציב',
    });
  });

  it('treats relaxing every filter as nothing searchable rather than returning all inventory', async () => {
    const onlyCategory = { ...emptyBuyerCriteria('en'), categories: ['rare_books'] };
    const outcome = await orchestrator.search({
      criteria: onlyCategory,
      language: 'en',
      leadId: 'buyer-lead-all-relaxed',
      status: 'new',
      createdAt: '2026-10-06T09:00:00.000Z',
      searchedAt: '2026-10-06T09:01:00.000Z',
      approvedRelaxations: [{ field: 'categories', approvedAt }],
    });

    expect(outcome.kind).toBe('insufficient-criteria');
    expect(searchRequests).toEqual([]);
  });
});
