import { buyerHistoryFixtureLots } from './buyer-history-fixture-lots';
import { getComparableSaleHistory } from './comparable-sale-history';

describe('getComparableSaleHistory', () => {
  it('returns sold lots with the same itemKey in chronological order', () => {
    const upcoming = buyerHistoryFixtureLots[0];
    if (!upcoming) throw new Error('missing fixture');
    const sales = getComparableSaleHistory(upcoming, buyerHistoryFixtureLots);
    expect(sales).toHaveLength(2);
    expect(sales[0]?.id).toBe('lot-history-sold-001');
    expect(sales[1]?.id).toBe('lot-history-sold-002');
    expect(sales.every((lot) => lot.status === 'sold')).toBe(true);
  });
});
