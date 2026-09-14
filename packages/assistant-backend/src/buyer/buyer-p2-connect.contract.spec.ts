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
  criteria: BuyerCriteria;
  language: 'en' | 'he';
  expectedRequest: SearchRequest;
  namedLotId: string;
  expectedResponse: PaginatedSearchResult<AuctionLot>;
};

const lead = {
  leadId: 'buyer-lead-p2-connect',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

describe('B3 <-> P2 Week 4 connect contract (named fixture: lot-kestenbaum-54554-121421)', () => {
  it('builds exactly the SearchRequest P2 expects: categories+price as filters, creators text-only', () => {
    expect(criteriaToSearchRequest(contract.criteria, contract.language)).toEqual(
      contract.expectedRequest,
    );
  });

  it('consumes exactly the PaginatedResult shape P2 returns and hands the named lot to B4', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(contract.expectedResponse) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

    const outcome = await orchestrator.search({
      criteria: contract.criteria,
      language: contract.language,
      ...lead,
    });

    expect(p2.search).toHaveBeenCalledWith(contract.expectedRequest);
    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    const handedOffIds = [...outcome.results.current, ...outcome.results.historical].map(
      (entry) => entry.lot.id,
    );
    expect(handedOffIds).toEqual([contract.namedLotId]);
  });
});
