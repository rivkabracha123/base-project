import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auctionLotSchema, matchReasonSchema, type AuctionLot } from '@monabid/shared';
import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { LotMatch, LotSearchResult } from '../lots/lot-match';

// Wraps fixture matches as the single-page result the lots search API returns.
const page = (data: LotMatch[]): LotSearchResult => ({
  data,
  total: data.length,
  page: 1,
  limit: data.length || 10,
  totalPages: data.length > 0 ? 1 : 0,
});

// Demo scenario: trace criteria through search to grouped results or an unmatched-demand summary.
const contract = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-explained-results.json'),
    'utf8',
  ),
) as {
  scenario: {
    language: 'en' | 'he';
    criteria: BuyerCriteria;
    resultMatches: Array<{ lot: unknown; matchReasons: unknown[] }>;
    unmatchedLots: unknown[];
  };
  expected: {
    hardConstraints: unknown[];
    results: {
      currentLotIds: string[];
      historicalLotIds: string[];
      matchReasonsByLot: Record<string, Array<{ field: string; detail: string }>>;
    };
    demandSummary: { appliedCriteria: string[]; recovery: string };
  };
};

const { scenario, expected } = contract;

// The buyer criteria, rebuilt on a real emptyBuyerCriteria base so the fixture cannot drift.
const buyerCriteria = (): BuyerCriteria => ({
  ...emptyBuyerCriteria(scenario.language),
  ...scenario.criteria,
});

const searchResultMatches: LotMatch[] = scenario.resultMatches.map((entry) => ({
  lot: auctionLotSchema.parse(entry.lot),
  matchReasons: entry.matchReasons.map((reason) => matchReasonSchema.parse(reason)),
}));
const lead = {
  leadId: 'buyer-lead-explained-results-demo',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};
const forbiddenKeys = ['profileId', 'sessionId', 'contact', 'conversation'];

// Reduces explained-lot entries to a { lotId: matchReasons } map for comparison.
const reasonsFor = (entries: Array<{ lot: AuctionLot; matchReasons: unknown }>) =>
  Object.fromEntries(entries.map((entry) => [entry.lot.id, entry.matchReasons]));

describe('Search explained results contract (criteria → grouped results / no-match summary)', () => {
  it('groups exactly the lots search returned into current/historical with its match reasons unchanged', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page(searchResultMatches)) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria: buyerCriteria(),
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;

    expect(outcome.results.current.map((entry) => entry.lot.id)).toEqual(
      expected.results.currentLotIds,
    );
    expect(outcome.results.historical.map((entry) => entry.lot.id)).toEqual(
      expected.results.historicalLotIds,
    );
    expect({
      ...reasonsFor(outcome.results.current),
      ...reasonsFor(outcome.results.historical),
    }).toEqual(expected.results.matchReasonsByLot);

    // Criteria and derived hard constraints are carried through unchanged on the search output.
    expect(outcome.searchRequest.criteria).toEqual(buyerCriteria());
    expect(outcome.searchRequest.hardConstraints).toEqual(expected.hardConstraints);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('adds no lot the lots search API did not return', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page(searchResultMatches)) };
    const outcome = await new BuyerSearchOrchestrator(lotsSearch).search({
      criteria: buyerCriteria(),
      language: scenario.language,
      ...lead,
    });

    if (outcome.kind !== 'results') throw new Error('expected results');
    const returnedIds = searchResultMatches.map((entry) => entry.lot.id).sort();
    const groupedLotIds = [...outcome.results.current, ...outcome.results.historical]
      .map((entry) => entry.lot.id)
      .sort();
    expect(groupedLotIds).toEqual(returnedIds);
  });

  it('recovers from no results with an honest demand summary and no budget relaxation', async () => {
    const lotsSearch = { search: jest.fn().mockResolvedValue(page(scenario.unmatchedLots as LotMatch[])) };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria: buyerCriteria(),
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;

    const { unmatchedDemand } = outcome.view;
    expect(unmatchedDemand.reason).toBe('no_results');
    expect(unmatchedDemand.demandSummary.appliedCriteria).toEqual(
      expected.demandSummary.appliedCriteria,
    );
    expect(unmatchedDemand.demandSummary.recovery).toBe(expected.demandSummary.recovery);
    expect(unmatchedDemand.demandSummary.hardConstraints).toEqual(expected.hardConstraints);
    // Budget survived: same bounds from criteria, nothing widened.
    expect(unmatchedDemand.searchRequest.criteria.price).toEqual(scenario.criteria.price);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });
});
