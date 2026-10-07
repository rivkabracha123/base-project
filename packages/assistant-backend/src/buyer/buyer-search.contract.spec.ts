import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot } from '@monabid/shared';
import { emptyBuyerCriteria, type BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { PaginatedSearchResult } from './search-request';

const repoRoot = resolve(__dirname, '../../../..');

// Wraps fixture lots as the single-page PaginatedResult the real lots search() returns.
const page = (data: AuctionLot[]): PaginatedSearchResult<AuctionLot> => ({
  data,
  total: data.length,
  page: 1,
  limit: data.length || 10,
  totalPages: data.length > 0 ? 1 : 0,
});

const contract = JSON.parse(
  readFileSync(
    resolve(repoRoot, 'fixtures/demo-scenarios/buyer-search-preserved-budget.json'),
    'utf8',
  ),
);

const lots = JSON.parse(
  readFileSync(resolve(repoRoot, 'fixtures/auction-data/lots.json'), 'utf8'),
) as AuctionLot[];

// The pre-canonical flat criteria shape the committed fixture still uses.
type LegacyCriteria = {
  budget?: { min?: number; max?: number };
  category?: string;
  creator?: string;
  period?: string;
  location?: string;
  keywords?: string[];
};

// Maps the fixture's legacy criteria onto a canonical BuyerCriteria.
const legacyToCanonical = (legacy: LegacyCriteria, language: 'en' | 'he' = 'en'): BuyerCriteria => {
  const criteria = emptyBuyerCriteria(language);
  if (legacy.budget) criteria.price = { ...legacy.budget, currency: 'USD' };
  if (legacy.category) criteria.categories = [legacy.category];
  if (legacy.creator) criteria.creators = [legacy.creator];
  if (legacy.period) criteria.periods = [legacy.period];
  if (legacy.location) criteria.geography = [legacy.location];
  if (legacy.keywords) criteria.keywords = legacy.keywords;
  return criteria;
};

// Looks up a committed fixture lot by id, throwing if it is missing.
const lotById = (id: string): AuctionLot => {
  const lot = lots.find((l) => l.id === id);
  if (!lot) throw new Error(`fixture lot ${id} not found`);
  return lot;
};

const lead = {
  leadId: 'buyer-lead-demo-1',
  status: 'new',
  createdAt: '2026-09-01T10:00:00.000Z',
  searchedAt: '2026-09-01T10:01:00.000Z',
};

const forbiddenKeys = ['profileId', 'sessionId', 'conversation'];

// Traces one named fixture from buyer criteria and lots search through the orchestrator into the results and unmatched-demand hand-offs, budget and filters preserved.
describe('Buyer search hand-off hard-constraint preservation contract', () => {
  const { scenario, expected } = contract;
  const criteria = legacyToCanonical(scenario.criteria, scenario.language);
  const expectedCriteria = legacyToCanonical(
    expected.results.searchRequest.criteria,
    expected.results.searchRequest.language,
  );

  it('carries the whole received criteria onto the results hand-off', async () => {
    const lotsSearch = {
      search: jest.fn().mockResolvedValue(page(scenario.searchResults.resultsCase.map(lotById))),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria).toEqual(expectedCriteria);
    expect(outcome.searchRequest.hardConstraints.map((constraint) => constraint.field)).toEqual([
      'price',
      'categories',
      'creators',
      'periods',
      'geography',
    ]);
    expect(
      [...outcome.results.current, ...outcome.results.historical].map((entry) => entry.lot.id),
    ).toEqual(expected.results.itemIds);

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('carries the whole received criteria onto the unmatched-demand hand-off without inventing inventory', async () => {
    const lotsSearch = {
      search: jest.fn().mockResolvedValue(page(scenario.searchResults.unmatchedCase.map(lotById))),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('unmatched');
    if (outcome.kind !== 'unmatched') return;
    expect(outcome.view.unmatchedDemand.searchRequest.criteria).toEqual(expectedCriteria);
    expect(outcome.view.unmatchedDemand.searchRequest.language).toBe(scenario.language);
    expect(outcome.view.unmatchedDemand.reason).toBe('no_results');
    expect(outcome.view.unmatchedDemand.demandSummary.recovery).toBe('no_relaxation_no_invention');
    expect(outcome.view.unmatchedDemand.demandSummary.hardConstraints).toEqual(
      outcome.view.unmatchedDemand.searchRequest.hardConstraints,
    );

    const serialized = JSON.stringify(outcome);
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(key);
    }
  });

  it('leaves the received budget unchanged on the handoff (no silent relaxation)', async () => {
    const lotsSearch = {
      search: jest.fn().mockResolvedValue(page(scenario.searchResults.resultsCase.map(lotById))),
    };
    const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

    const outcome = await orchestrator.search({
      criteria,
      language: scenario.language,
      ...lead,
    });

    expect(outcome.kind).toBe('results');
    if (outcome.kind !== 'results') return;
    expect(outcome.searchRequest.criteria.price).toEqual(criteria.price);
  });
});
