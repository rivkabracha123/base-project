import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import type { Repository } from 'typeorm';
import type { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsService } from '../lots/lots.service';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator, type LotsSearchClient } from './buyer-search.orchestrator';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import type { SearchRequest } from './search-request';

// B3 <-> P2 Week 4 CONNECT: same named fixture as buyer-p2-connect.contract.spec.ts,
// but run against Mali's actual LotsService (only the DB repository is faked) instead
// of a jest.fn() stand-in for search — proves the wired flow, alias resolution included.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-p2-connect.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedResponse: { data: AuctionLot[] };
  scenarios: Array<{ name: string; criteria: BuyerCriteria; language: 'en' | 'he' }>;
};

const lead = {
  leadId: 'buyer-lead-p2-connect-real',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

for (const scenario of contract.scenarios) {
  it(`sends "${scenario.name}" criteria to the real LotsService and gets the named lot back (${contract.namedLotId})`, async () => {
    const entities = contract.expectedResponse.data.map((payload) => ({ payload }));
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([entities, entities.length]),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    // Mali's real search — no mocked "P2", just her service with a faked DB layer.
    const lotsService = new LotsService(repository);
    const p2: LotsSearchClient = { search: (request: SearchRequest) => lotsService.search(request) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const searchRequest = criteriaToSearchRequest(scenario.criteria, scenario.language);
    const outcome = await orchestrator.search({
      criteria: scenario.criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    const handedOffIds = [...outcome.results.current, ...outcome.results.historical].map(
      (entry) => entry.lot.id,
    );
    expect(handedOffIds).toEqual([contract.namedLotId]);

    // The Hebrew-alias scenario must still resolve through P2's real alias table,
    // not just pass because the mock ignores the query.
    if (searchRequest.filters?.categories) {
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
        { categories: ['rare_books'] },
      );
    }
  });
}
