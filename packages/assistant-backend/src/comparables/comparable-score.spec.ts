import type { AuctionLot } from '@monabid/shared';
import { scoreComparable, partitionAndSort } from './comparable-score';

const base: AuctionLot = {
  id: 'lot-1',
  source: { provider: 'demo', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Demo Lot' },
  description: { en: 'A demo lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1000, currency: 'USD' },
};

const item = { category: 'rare_books' };

describe('scoreComparable', () => {
  it('includes a sold same-category lot with a realized price', () => {
    const result = scoreComparable(base, item);
    expect(result.included).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.exclusionReason).toBeUndefined();
  });

  it('excludes an unsold lot even when the category matches', () => {
    const lot: AuctionLot = { ...base, status: 'unsold', realizedPrice: undefined };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/unsold/i);
  });

  it('excludes a sold same-category lot that has no realized price', () => {
    const lot: AuctionLot = { ...base, realizedPrice: undefined };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/realized price/i);
  });

  it('excludes a credible lot in a different category with score 0', () => {
    const lot: AuctionLot = { ...base, category: 'judaica' };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.score).toBe(0.0);
    expect(result.exclusionReason).toMatch(/category/i);
  });

  it('preserves the lot on every result so callers have the full evidence', () => {
    const result = scoreComparable(base, item);
    expect(result.lot).toEqual(base);
  });

  it('provides a non-empty matchReason on every result', () => {
    expect(scoreComparable(base, item).matchReason).toBeTruthy();
    expect(scoreComparable({ ...base, status: 'unsold', realizedPrice: undefined }, item).matchReason).toBeTruthy();
    expect(scoreComparable({ ...base, category: 'judaica' }, item).matchReason).toBeTruthy();
  });
});

describe('partitionAndSort', () => {
  const sold = (id: string, date: string, cat = 'rare_books'): AuctionLot => ({
    ...base, id, category: cat, saleDate: date,
    realizedPrice: { amount: 500, currency: 'USD' },
  });
  const unsold = (id: string, date: string): AuctionLot => ({
    ...base, id, saleDate: date, status: 'unsold', realizedPrice: undefined,
  });

  it('places credible lots in included and non-credible in excluded', () => {
    const scores = [
      scoreComparable(sold('a', '2025-01-01'), item),
      scoreComparable(unsold('b', '2025-01-01'), item),
    ];
    const result = partitionAndSort(scores);
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.included[0]!.lot.id).toBe('a');
    expect(result.excluded[0]!.lot.id).toBe('b');
  });

  it('sorts included by score descending then saleDate descending', () => {
    const scores = [
      scoreComparable(sold('older', '2024-01-01'), item),
      scoreComparable(sold('newer', '2025-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included[0]!.lot.id).toBe('newer');
    expect(included[1]!.lot.id).toBe('older');
  });

  it('breaks ties by lot id so order is fully deterministic', () => {
    const scores = [
      scoreComparable(sold('zzz', '2025-01-01'), item),
      scoreComparable(sold('aaa', '2025-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included[0]!.lot.id).toBe('aaa');
    expect(included[1]!.lot.id).toBe('zzz');
  });

  it('produces identical output for identical input on repeated calls', () => {
    const scores = [
      scoreComparable(sold('x', '2025-01-01'), item),
      scoreComparable(unsold('y', '2024-06-01'), item),
      scoreComparable(sold('m', '2024-01-01'), item),
    ];
    const first = partitionAndSort(scores);
    const second = partitionAndSort(scores);
    expect(first.included.map(s => s.lot.id)).toEqual(second.included.map(s => s.lot.id));
    expect(first.excluded.map(s => s.lot.id)).toEqual(second.excluded.map(s => s.lot.id));
  });

  it('unsold lots never appear in the included list', () => {
    const scores = [
      scoreComparable(unsold('u1', '2025-01-01'), item),
      scoreComparable(unsold('u2', '2024-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included).toHaveLength(0);
  });
});
