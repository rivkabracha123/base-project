import { emptyBuyerCriteria } from './buyer-criteria';
import { criteriaToSearchRequest } from './criteria-to-search-request';

describe('criteriaToSearchRequest', () => {
  it('creates a basic text search request with caller-supplied language', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.periods = ['15th century'];
    criteria.keywords = ['rare', 'Hebrew', 'books'];

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'Yitzhak Abrabanel rare Hebrew books',
      language: 'en',
      filters: { categories: ['rare_books'] },
    });
  });

  it('does not infer language from buyer criteria', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];

    expect(criteriaToSearchRequest(criteria, 'he')).toEqual({
      query: '',
      language: 'he',
      filters: { categories: ['rare_books'] },
    });
  });

  it('preserves the approved optional search criteria', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.media = ['painting'];
    criteria.geography = ['Israel'];
    criteria.keywords = ['blue', 'modern'];
    criteria.price = { min: 500, max: 1200, currency: 'USD' };

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'blue modern',
      language: 'en',
      filters: { price: { min: 500, max: 1200, currency: 'USD' } },
    });
  });

  it('sends structured filters for every P1-populated facet, leaving creators and unsupported facets text-only', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    // creators has a P2 filter facet but no committed lot populates the creator
    // column yet; sending it would AND-zero out otherwise-matching results.
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.auctionHouseIds = ['house-1'];
    criteria.dateRange = { from: '2026-01-01', to: '2026-12-31' };
    criteria.price = { min: 500, max: 1200, currency: 'USD' };
    // periods/media/geography have no P2 filter facet at all and must stay out of `filters`.
    criteria.periods = ['15th century'];
    criteria.media = ['painting'];
    criteria.geography = ['Israel'];

    expect(criteriaToSearchRequest(criteria, 'en').filters).toEqual({
      categories: ['rare_books'],
      auctionHouseIds: ['house-1'],
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
      price: { min: 500, max: 1200, currency: 'USD' },
    });
  });

  it('omits filters entirely when no criteria map to a P2-supported facet', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.keywords = ['rare'];
    criteria.periods = ['15th century'];

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'rare',
      language: 'en',
    });
  });
});
