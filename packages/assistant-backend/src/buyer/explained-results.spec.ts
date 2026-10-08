import type { AuctionLot } from '@monabid/shared';
import { emptyBuyerCriteria } from './buyer-criteria';
import {
  buildDemandSummary,
  deriveHardConstraints,
  explainMatch,
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

describe('explainMatch', () => {
  it('emits only reasons it can verify from the criteria and the lot', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];
    criteria.price = { min: 500, max: 5000, currency: 'USD' };

    const lot = makeLot({
      id: 'lot-1',
      auctionTitle: 'Rare Hebrew Printed Books, Manuscripts & Judaica',
      title: { en: 'Atereth Zekeinim by Yitzhak Abrabanel' },
      realizedPrice: { amount: 1200, currency: 'USD' },
    });

    expect(explainMatch(criteria, lot)).toEqual([
      { field: 'categories', detail: 'rare_books' },
      { field: 'price', detail: 'within the stated budget' },
      { field: 'creators', detail: 'Yitzhak Abrabanel' },
      { field: 'keywords', detail: 'manuscript' },
    ]);
  });

  it('does not claim a budget match when the lot price is outside the range', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 100, max: 900, currency: 'USD' };
    const lot = makeLot({ id: 'lot-2', realizedPrice: { amount: 1200, currency: 'USD' } });

    expect(explainMatch(criteria, lot)).toEqual([]);
  });

  it('does not claim a budget match when the lot has no price at all', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.price = { min: 100, max: 900, currency: 'USD' };
    const lot = makeLot({ id: 'lot-3', estimate: undefined, realizedPrice: undefined });

    expect(explainMatch(criteria, lot)).toEqual([]);
  });

  it('matches a period against the sale year when it is not in the text', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.periods = ['2025'];
    const lot = makeLot({ id: 'lot-4', saleDate: '2025-01-23' });

    expect(explainMatch(criteria, lot)).toEqual([{ field: 'periods', detail: '2025' }]);
  });
});

describe('groupExplainedLots', () => {
  it('splits exactly the P2 lots into current (upcoming) and historical', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];

    const upcoming = makeLot({ id: 'lot-upcoming', status: 'upcoming' });
    const sold = makeLot({ id: 'lot-sold', status: 'sold' });
    const withdrawn = makeLot({ id: 'lot-withdrawn', status: 'withdrawn' });

    const grouped = groupExplainedLots(criteria, [upcoming, sold, withdrawn]);

    expect(grouped.current.map((entry) => entry.lot.id)).toEqual(['lot-upcoming']);
    expect(grouped.historical.map((entry) => entry.lot.id)).toEqual(['lot-sold', 'lot-withdrawn']);
    expect(grouped.current[0]?.matchReasons).toEqual([{ field: 'categories', detail: 'rare_books' }]);
  });

  it('keeps the original lot object references', () => {
    const criteria = emptyBuyerCriteria('en');
    const sold = makeLot({ id: 'lot-sold' });

    const grouped = groupExplainedLots(criteria, [sold]);

    expect(grouped.historical[0]?.lot).toBe(sold);
  });
});

describe('buildDemandSummary', () => {
  it('leaves criteria P2 cannot filter out of appliedCriteria', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.periods = ['19th century'];
    criteria.geography = ['Israel'];
    criteria.media = ['painting'];

    expect(buildDemandSummary(criteria).appliedCriteria).toEqual(['categories']);
  });

  it('lists the active criteria, keeps the hard constraints, and records safe recovery', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.keywords = ['manuscript'];
    criteria.price = { min: 500, max: 5000, currency: 'USD' };

    expect(buildDemandSummary(criteria)).toEqual({
      appliedCriteria: ['price', 'categories', 'creators', 'keywords'],
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
