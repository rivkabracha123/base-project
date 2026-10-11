import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import { criteriaToSearchRequest } from './criteria-to-search-request';
import type { LotSearchResult } from '../lots/lot-match';
import type { SearchRequest } from './search-request';

// Shared named-fixture proof for criteria → lots search; see the fixture's own `description`.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedExplainedResponse: LotSearchResult;
  scenarios: Array<{
    name: string;
    criteria: BuyerCriteria;
    language: 'en' | 'he';
    expectedRequest: SearchRequest;
  }>;
};

const lead = {
  leadId: 'buyer-lead-named-lot',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

for (const scenario of contract.scenarios) {
  describe(`Criteria to lots search request: ${scenario.name} (named fixture: ${contract.namedLotId})`, () => {
    it('builds exactly the SearchRequest the lots API expects for this scenario', () => {
      expect(criteriaToSearchRequest(scenario.criteria, scenario.language)).toEqual(
        scenario.expectedRequest,
      );
    });

    it('consumes the paginated lots response and hands the named lot to results', async () => {
      const lotsSearch = { search: jest.fn().mockResolvedValue(contract.expectedExplainedResponse) };
      const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

      const outcome = await orchestrator.search({
        criteria: scenario.criteria,
        language: scenario.language,
        ...lead,
      });

      expect(lotsSearch.search).toHaveBeenCalledWith(scenario.expectedRequest);
      expect(outcome.kind).toBe('results');
      if (outcome.kind !== 'results') return;
      const groupedLotIds = [...outcome.results.current, ...outcome.results.historical].map(
        (entry) => entry.lot.id,
      );
      expect(groupedLotIds).toEqual([contract.namedLotId]);
      // Match reasons are the lots search's own, passed through unchanged.
      expect([...outcome.results.current, ...outcome.results.historical]).toEqual(
        contract.expectedExplainedResponse.data,
      );
    });
  });
}
