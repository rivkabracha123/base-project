import type { PreparedAuctionHouse, RankingItem } from '@monabid/shared';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses, reasonIsSupported } from './house-rank';

const successItem: RankingItem = {
  category: 'rare_books',
  geography: 'United States',
  preferredLanguage: 'en',
};

const forbiddenReasonPatterns = ['commission', 'shipping', 'acceptance', 'will accept', 'consignment'];

describe('rankActiveHouses', () => {
  const houses = loadPreparedHouses();

  it('ranks the success fixture with a recommended house, alternatives, and excluded inactive houses', () => {
    const ranking = rankActiveHouses(houses, successItem);

    expect(ranking.recommendation?.house.id).toBe('house-kestenbaum');
    expect(ranking.alternatives.map((row) => row.house.id)).toEqual([
      'house-kedem',
      'house-judaica-specialist',
    ]);
    expect(ranking.excluded.map((row) => row.house.id)).toEqual(['house-inactive-demo']);
    expect(ranking.recommendation?.reasons.length).toBeGreaterThan(0);
  });

  it('excludes inactive houses even when their prepared comparable counts are higher', () => {
    const ranking = rankActiveHouses(houses, successItem);
    const rankedIds = [
      ranking.recommendation?.house.id,
      ...ranking.alternatives.map((row) => row.house.id),
    ].filter(Boolean);

    expect(rankedIds).not.toContain('house-inactive-demo');
    expect(ranking.excluded.map((row) => row.house.id)).toContain('house-inactive-demo');

    const reasons = [
      ...(ranking.recommendation?.reasons ?? []),
      ...ranking.alternatives.flatMap((row) => row.reasons),
      ...ranking.excluded.flatMap((row) => row.reasons),
    ];

    for (const reason of reasons) {
      expect(reasonIsSupported(reason)).toBe(true);
      for (const pattern of forbiddenReasonPatterns) {
        expect(reason.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it('returns the same order for identical input', () => {
    const item: RankingItem = { category: 'rare_books', geography: 'United States', preferredLanguage: 'en' };

    expect(rankActiveHouses(houses, item)).toEqual(rankActiveHouses(houses, item));
  });

  it('does not recommend any house when every prepared house is inactive', () => {
    const inactive = houses.map((house) => ({ ...house, active: false }));

    const ranking = rankActiveHouses(inactive, { category: 'rare_books' });

    expect(ranking.recommendation).toBeNull();
    expect(ranking.alternatives).toEqual([]);
    expect(ranking.excluded).toHaveLength(inactive.length);
  });

  it('breaks score ties by house id so ranking stays deterministic', () => {
    const tied: PreparedAuctionHouse[] = [
      {
        id: 'house-b',
        name: 'B',
        active: true,
        categories: ['rare_books'],
        languages: [],
        comparableSoldCountByCategory: {},
      },
      {
        id: 'house-a',
        name: 'A',
        active: true,
        categories: ['rare_books'],
        languages: [],
        comparableSoldCountByCategory: {},
      },
    ];

    const ranking = rankActiveHouses(tied, { category: 'rare_books' });

    expect(ranking.recommendation?.house.id).toBe('house-a');
    expect(ranking.alternatives.map((row) => row.house.id)).toEqual(['house-b']);
  });

  it('rejects unsupported commission and acceptance claims in reasons', () => {
    expect(reasonIsSupported('Prepared house lists specialization in rare_books')).toBe(true);
    expect(reasonIsSupported('5% commission')).toBe(false);
    expect(reasonIsSupported('The house will accept this consignment')).toBe(false);
  });
});
