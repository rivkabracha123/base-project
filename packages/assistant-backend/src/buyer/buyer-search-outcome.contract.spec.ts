import type { AuctionLot, BuyerSearchOutcome } from '@monabid/shared';
import { emptyBuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { LotSearchResult } from '../lots/lot-match';

// Pins the exact shape the result cards read; adding, removing or renaming a field fails here first.

const lead = {
  leadId: 'lead-contract',
  status: 'new',
  createdAt: '2026-10-12T09:00:00.000Z',
  searchedAt: '2026-10-12T09:01:00.000Z',
  selectedLotId: 'lot-upcoming',
};

// Builds a full AuctionLot for tests, overriding any fields via `over`.
const makeLot = (over: Partial<AuctionLot> & { id: string }): AuctionLot => ({
  source: {
    provider: 'test',
    recordId: over.id,
    url: `https://example.com/${over.id}`,
    retrievedAt: '2025-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'house-test', name: 'Test House' },
  auctionTitle: 'Test Auction',
  lotNumber: '1',
  title: { en: `Test Lot ${over.id}` },
  description: { en: 'A test lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  ...over,
});

const upcoming = makeLot({ id: 'lot-upcoming', status: 'upcoming', saleDate: '2026-12-01' });
const sold = makeLot({ id: 'lot-sold' });

// Lots search returning the given lots, each with one category match reason.
const lotsSearch = (lots: AuctionLot[]) => ({
  search: jest.fn(async (): Promise<LotSearchResult> => ({
    data: lots.map((lot) => ({ lot, matchReasons: [{ field: 'categories' as const, detail: 'rare_books' }] })),
    total: lots.length,
    page: 1,
    limit: 50,
    totalPages: lots.length > 0 ? 1 : 0,
  })),
});

// Category plus a strict budget, so both a result and a no-result are reachable.
const criteria = () => ({
  ...emptyBuyerCriteria('en'),
  categories: ['rare_books'],
  price: { min: 100, max: 500, currency: 'USD' },
});

// Sorted field names, so a renamed, added or missing field shows up in the diff.
const keys = (value: object) => Object.keys(value).sort();

describe('Buyer search outcome contract for the result cards', () => {
  it('hands results with exactly these fields, grouped, with the lot unmodified and its reasons as field and detail', async () => {
    const outcome: BuyerSearchOutcome = await new BuyerSearchOrchestrator(lotsSearch([upcoming, sold])).search({
      criteria: criteria(),
      language: 'en',
      ...lead,
    });

    if (outcome.kind !== 'results') throw new Error(`expected results, got ${outcome.kind}`);
    expect(keys(outcome)).toEqual(['approvedRefinements', 'kind', 'results', 'searchRequest', 'selectedLotId']);
    expect(keys(outcome.searchRequest)).toEqual(['criteria', 'hardConstraints', 'language']);
    expect(keys(outcome.results)).toEqual(['current', 'historical']);
    expect(outcome.results.current.map((entry) => entry.lot)).toEqual([upcoming]);
    expect(outcome.results.historical.map((entry) => entry.lot)).toEqual([sold]);
    for (const entry of [...outcome.results.current, ...outcome.results.historical]) {
      expect(keys(entry)).toEqual(['lot', 'matchReasons']);
      for (const reason of entry.matchReasons) expect(keys(reason)).toEqual(['detail', 'field']);
    }
    expect(outcome.approvedRefinements).toEqual([]);
    expect(outcome.selectedLotId).toBe('lot-upcoming');
  });

  it('hands a no-result with exactly these fields and every relaxation option behind approval', async () => {
    const outcome: BuyerSearchOutcome = await new BuyerSearchOrchestrator(lotsSearch([])).search({
      criteria: criteria(),
      language: 'en',
      ...lead,
    });

    if (outcome.kind !== 'unmatched') throw new Error(`expected unmatched, got ${outcome.kind}`);
    expect(keys(outcome)).toEqual(['kind', 'relaxationOptions', 'selectedLotId', 'view']);
    expect(keys(outcome.view)).toEqual(['createdAt', 'id', 'status', 'type', 'unmatchedDemand']);
    expect(keys(outcome.view.unmatchedDemand)).toEqual(['demandSummary', 'reason', 'searchRequest', 'searchedAt']);
    expect(outcome.relaxationOptions).toEqual([
      { field: 'categories', requiresApproval: true },
      { field: 'price', requiresApproval: true },
    ]);
  });

  it('hands a missing-criteria state with exactly these fields and never calls the lots search', async () => {
    const search = lotsSearch([upcoming]);
    const outcome: BuyerSearchOutcome = await new BuyerSearchOrchestrator(search).search({
      criteria: emptyBuyerCriteria('en'),
      language: 'en',
      ...lead,
    });

    expect(outcome.kind).toBe('insufficient-criteria');
    expect(keys(outcome)).toEqual(['kind', 'searchRequest', 'selectedLotId']);
    expect(search.search).not.toHaveBeenCalled();
  });
});
