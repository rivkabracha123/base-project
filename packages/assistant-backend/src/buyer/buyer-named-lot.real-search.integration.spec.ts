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

// Buyer search <-> lots search: same named fixture as the lots-search contract spec,
// but run against the real LotsService (only the DB repository is faked) instead
// of a jest.fn() stand-in for search — proves the wired flow, alias resolution included.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedExplainedResponse: { data: Array<{ lot: AuctionLot }> };
  scenarios: Array<{ name: string; criteria: BuyerCriteria; language: 'en' | 'he' }>;
};

const lead = {
  leadId: 'buyer-lead-named-lot-real',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

for (const scenario of contract.scenarios) {
  it(`sends "${scenario.name}" criteria to the real LotsService and gets the named lot back (${contract.namedLotId})`, async () => {
    const entities = contract.expectedExplainedResponse.data.map((entry) => ({ payload: entry.lot }));
    const queryBuilder = {
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
      getRawAndEntities: jest.fn().mockResolvedValue({ entities, raw: [] }),
      getCount: jest.fn().mockResolvedValue(entities.length),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    // The real lots search service, not a mock; only the DB layer is faked.
    const lotsService = new LotsService(repository);
    const lotsSearch: LotsSearchClient = { search: (request: SearchRequest) => lotsService.search(request) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

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

    // The Hebrew-alias scenario must still resolve through the real alias table,
    // not just pass because the mock ignores the query.
    if (searchRequest.filters?.categories) {
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
        { categories: ['rare_books'] },
      );
    }
  });
}
