import { sellerComparisonCategory } from './seller-item-readiness';

describe('seller category aliases', () => {
  it.each(['manuscripts', 'manuscript', 'rare books'])('maps %s to the canonical auction category', category => {
    expect(sellerComparisonCategory(category, '')).toBe('rare_books');
  });
  it('preserves unrelated categories', () => {
    expect(sellerComparisonCategory('paintings', '')).toBe('paintings');
  });
});
