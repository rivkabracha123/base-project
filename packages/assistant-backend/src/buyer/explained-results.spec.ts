import type { AuctionLot } from '@monabid/shared';
import { emptyBuyerCriteria } from './buyer-criteria';
import {
  buildDemandSummary,
  deriveHardConstraints,
  groupExplainedLots,
} from './explained-results';

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

describe('deriveHardConstraints', () => {
  it('keeps the budget as a range constraint whenever a price is set', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 500, max: 5000, currency: 'USD' };

    expect(deriveHardConstraints(criteria)).toEqual([
      {
        field: 'price',
        operator: 'range',
        value: { min: 500, max: 5000, currency: 'USD' },
        reason: 'Buyer budget is a hard limit and is not relaxed without approval',
      },
    ]);
  });

  it('turns every strict array filter into a contains constraint and leaves keywords soft', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];

    expect(deriveHardConstraints(criteria)).toEqual([
      { field: 'categories', operator: 'contains', value: ['rare_books'], reason: 'Buyer requirement kept through refinement' },
      { field: 'creators', operator: 'contains', value: ['Yitzhak Abrabanel'], reason: 'Buyer requirement kept through refinement' },
    ]);
  });

  it('returns no constraints for empty criteria', () => {
    expect(deriveHardConstraints(emptyBuyerCriteria('en'))).toEqual([]);
  });
});

describe('groupExplainedLots', () => {
  it('splits exactly the returned matches into current (upcoming) and historical, reasons unchanged', () => {
    const upcoming = { lot: makeLot({ id: 'lot-upcoming', status: 'upcoming' }), matchReasons: [{ field: 'categories' as const, detail: 'rare_books' }] };
    const sold = { lot: makeLot({ id: 'lot-sold', status: 'sold' }), matchReasons: [] };
    const withdrawn = { lot: makeLot({ id: 'lot-withdrawn', status: 'withdrawn' }), matchReasons: [] };

    const grouped = groupExplainedLots([upcoming, sold, withdrawn]);

    expect(grouped.current.map((entry) => entry.lot.id)).toEqual(['lot-upcoming']);
    expect(grouped.historical.map((entry) => entry.lot.id)).toEqual(['lot-sold', 'lot-withdrawn']);
    expect(grouped.current[0]?.matchReasons).toEqual([{ field: 'categories', detail: 'rare_books' }]);
  });

  it('keeps the lots search order and the original entry references', () => {
    const older = { lot: makeLot({ id: 'lot-older', saleDate: '2024-01-01' }), matchReasons: [] };
    const newer = { lot: makeLot({ id: 'lot-newer', saleDate: '2025-06-01' }), matchReasons: [] };

    const grouped = groupExplainedLots([older, newer]);

    expect(grouped.historical).toEqual([older, newer]);
    expect(grouped.historical[0]).toBe(older);
  });
});

describe('buildDemandSummary', () => {
  it('lists periods, places and media only when a value was sent to the lots search', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.periods = ['19th century'];
    criteria.geography = ['ישראל'];
    criteria.media = ['painting'];

    expect(buildDemandSummary(criteria).appliedCriteria).toEqual(['categories', 'periods', 'media']);
  });

  it('lists the active criteria, keeps the hard constraints, and records safe recovery', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];
    criteria.price = { min: 500, max: 5000, currency: 'USD' };

    expect(buildDemandSummary(criteria)).toEqual({
      appliedCriteria: ['price', 'categories', 'creators', 'query'],
      hardConstraints: [
        {
          field: 'price',
          operator: 'range',
          value: { min: 500, max: 5000, currency: 'USD' },
          reason: 'Buyer budget is a hard limit and is not relaxed without approval',
        },
        { field: 'categories', operator: 'contains', value: ['rare_books'], reason: 'Buyer requirement kept through refinement' },
        { field: 'creators', operator: 'contains', value: ['Yitzhak Abrabanel'], reason: 'Buyer requirement kept through refinement' },
      ],
      recovery: 'no_relaxation_no_invention',
    });
  });
});
