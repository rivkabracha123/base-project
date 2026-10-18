import type { BuyerCriteria } from '@monabid/shared';
import { rankActiveHouses } from '../seller-leads/house-rank';
import { loadPreparedHouses } from '../seller-leads/house-rank-fixture';
import type { SellerLeadsService } from '../seller-leads/seller-leads.service';
import type { BuyerCriteriaService } from './buyer-criteria.service';
import {
  BuyerHouseRecommendationService,
  keepSpecialists,
  toRankingItem,
} from './buyer-house-recommendation.service';

const criteria = (overrides: Partial<BuyerCriteria> = {}): BuyerCriteria => ({
  categories: [],
  creators: [],
  periods: [],
  media: [],
  keywords: [],
  geography: [],
  auctionHouseIds: [],
  language: 'he',
  hardConstraints: [],
  ...overrides,
});

describe('toRankingItem', () => {
  it('prefers the AI arguments over the session criteria', () => {
    expect(
      toRankingItem(
        { category: 'judaica', geography: 'Israel', language: 'he' },
        criteria({ categories: ['rare_books'], geography: ['United States'] }),
      ),
    ).toEqual({ category: 'judaica', geography: 'Israel', preferredLanguage: 'he' });
  });

  it('falls back to the latest session category and geography', () => {
    expect(
      toRankingItem(
        undefined,
        criteria({ categories: ['judaica', 'rare_books', ''], geography: ['Israel', 'United States'] }),
      ),
    ).toEqual({ category: 'rare_books', geography: 'United States' });
  });

  it('returns null when no category is known', () => {
    expect(toRankingItem({ geography: 'Israel' }, criteria())).toBeNull();
  });
});

describe('keepSpecialists', () => {
  it('keeps only houses that list the field, in ranking order', () => {
    const ranking = rankActiveHouses(loadPreparedHouses(), { category: 'judaica' });

    const result = keepSpecialists(ranking, 'judaica');

    expect([result.recommendation, ...result.alternatives].map((row) => row?.house.id)).toEqual([
      'house-kedem',
      'house-judaica-specialist',
    ]);
    expect(result.excluded).toBe(ranking.excluded);
  });

  it('recommends no house when none specializes in the field', () => {
    const ranking = rankActiveHouses(loadPreparedHouses(), { category: 'painting' });
    expect(ranking.recommendation).not.toBeNull();

    const result = keepSpecialists(ranking, 'painting');

    expect(result.recommendation).toBeNull();
    expect(result.alternatives).toEqual([]);
  });
});

describe('BuyerHouseRecommendationService', () => {
  it('calls the seller ranking with the session field and keeps its specialists', () => {
    const ranking = rankActiveHouses(loadPreparedHouses(), { category: 'rare_books' });
    const sellerLeads = { rankHouses: jest.fn(() => ranking) } as unknown as SellerLeadsService;
    const criteriaService = {
      getCriteriaForSession: jest.fn(() => criteria({ categories: ['rare_books'] })),
    } as unknown as BuyerCriteriaService;

    const result = new BuyerHouseRecommendationService(sellerLeads, criteriaService).recommend('s1');

    expect(sellerLeads.rankHouses).toHaveBeenCalledWith({ category: 'rare_books' });
    expect(result).toEqual(keepSpecialists(ranking, 'rare_books'));
  });

  it('uses only the AI arguments when the session is unknown', () => {
    const sellerLeads = {
      rankHouses: jest.fn(() => ({ recommendation: null, alternatives: [], excluded: [] })),
    } as unknown as SellerLeadsService;
    const criteriaService = {
      getCriteriaForSession: jest.fn(() => {
        throw new Error('Unknown buyer criteria session');
      }),
    } as unknown as BuyerCriteriaService;

    new BuyerHouseRecommendationService(sellerLeads, criteriaService).recommend('missing', {
      category: 'judaica',
    });

    expect(sellerLeads.rankHouses).toHaveBeenCalledWith({ category: 'judaica' });
  });
});
