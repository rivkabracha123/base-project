import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import type { PaginatedSearchResult, SearchRequest } from './search-request';

// B3 <-> P2 Week 4 CONNECT: shared named-fixture proof for both verification reports; see the fixture's own `description`.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-p2-connect.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedResponse: PaginatedSearchResult<AuctionLot>;
  scenarios: Array<{
    name: string;
    criteria: BuyerCriteria;
    language: 'en' | 'he';
    expectedRequest: SearchRequest;
  }>;
};

const lead = {
  leadId: 'buyer-lead-p2-connect',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

for (const scenario of contract.scenarios) {
  describe(`Criteria to P2 search request: ${scenario.name} (named fixture: ${contract.namedLotId})`, () => {
    it('builds exactly the SearchRequest P2 expects for this scenario', () => {
      expect(criteriaToSearchRequest(scenario.criteria, scenario.language)).toEqual(
        scenario.expectedRequest,
      );
    });

    it('consumes exactly the PaginatedResult shape P2 returns and hands the named lot to B4', async () => {
      const p2 = { search: jest.fn().mockResolvedValue(contract.expectedResponse) };
      const orchestrator = new BuyerSearchOrchestrator(p2);

      const outcome = await orchestrator.search({
        criteria: scenario.criteria,
        language: scenario.language,
        ...lead,
      });

      expect(p2.search).toHaveBeenCalledWith(scenario.expectedRequest);
      expect(outcome.kind).toBe('results');
      if (outcome.kind !== 'results') return;
      const handedOffIds = [...outcome.results.current, ...outcome.results.historical].map(
        (entry) => entry.lot.id,
      );
      expect(handedOffIds).toEqual([contract.namedLotId]);
    });
  });
}
