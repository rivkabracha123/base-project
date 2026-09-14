import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auctionLotSchema, type AuctionLot } from '@monabid/shared';
import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { PaginatedSearchResult } from './search-request';

// Wraps fixture lots as the single-page PaginatedResult P2's real search() returns.
const page = (data: AuctionLot[]): PaginatedSearchResult<AuctionLot> => ({
  data,
  total: data.length,
  page: 1,
  limit: data.length || 10,
  totalPages: data.length > 0 ? 1 : 0,
});

// Week 4 CONNECT checkpoint: trace one named fixture through the minimum B3 -> B4 / P5 contract.
const contract = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-explained-results.json'),
    'utf8',
  ),
) as {
  scenario: {
    language: 'en' | 'he';
    criteria: BuyerCriteria;
    p2ResultLots: unknown[];
    p2UnmatchedLots: unknown[];
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

// The criteria B2 hands over, rebuilt on a real emptyBuyerCriteria base so the fixture cannot drift.
const buyerCriteria = (): BuyerCriteria => ({
  ...emptyBuyerCriteria(scenario.language),
  ...scenario.criteria,
});

const p2ResultLots = scenario.p2ResultLots.map((lot) => auctionLotSchema.parse(lot));
const lead = {
  leadId: 'buyer-lead-w4-demo',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};
const forbiddenKeys = ['profileId', 'sessionId', 'contact', 'conversation'];

// Reduces explained-lot entries to a { lotId: matchReasons } map for comparison.
const reasonsFor = (entries: Array<{ lot: AuctionLot; matchReasons: unknown }>) =>
  Object.fromEntries(entries.map((entry) => [entry.lot.id, entry.matchReasons]));

describe('B3 Week 4 explained-results contract (B2 -> B3 -> B4 / P5)', () => {
  it('groups exactly the P2 lots into current/historical with derived match reasons', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page(p2ResultLots)) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

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

    // The whole criteria object and its derived hard constraints reach B4 unchanged.
    expect(outcome.searchRequest.criteria).toEqual(buyerCriteria());
    expect(outcome.searchRequest.hardConstraints).toEqual(expected.hardConstraints);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('adds no lot P2 did not return', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page(p2ResultLots)) };
    const outcome = await new BuyerSearchOrchestrator(p2).search({
      criteria: buyerCriteria(),
      language: scenario.language,
      ...lead,
    });

    if (outcome.kind !== 'results') throw new Error('expected results');
    const returnedIds = p2ResultLots.map((lot) => lot.id).sort();
    const handedOffIds = [...outcome.results.current, ...outcome.results.historical]
      .map((entry) => entry.lot.id)
      .sort();
    expect(handedOffIds).toEqual(returnedIds);
  });

  it('recovers from no results with an honest demand summary and no budget relaxation', async () => {
    const p2 = { search: jest.fn().mockResolvedValue(page(scenario.p2UnmatchedLots as AuctionLot[])) };
    const orchestrator = new BuyerSearchOrchestrator(p2);

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
    // Budget survived: same bounds B2 sent, nothing widened.
    expect(unmatchedDemand.searchRequest.criteria.price).toEqual(scenario.criteria.price);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });
});
