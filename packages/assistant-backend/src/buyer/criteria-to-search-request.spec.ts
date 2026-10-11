import { emptyBuyerCriteria } from './buyer-criteria';
import { criteriaToSearchRequest, toSearchPeriod, unfilteredCriteria } from './criteria-to-search-request';

describe('criteriaToSearchRequest', () => {
  it('creates a basic text search request with caller-supplied language', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.periods = ['15th century'];
    criteria.keywords = ['rare', 'Hebrew', 'books'];

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'rare Hebrew books',
      language: 'en',
      filters: { categories: ['rare_books'], creators: ['Yitzhak Abrabanel'], periods: ['15th century'] },
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
      filters: { geography: ['Israel'], media: ['painting'], price: { min: 500, max: 1200, currency: 'USD' } },
    });
  });

  it('sends structured filters for every populated auction-data facet', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];
    // creators has a P2 filter facet but no committed lot populates the creator column yet.
    criteria.creators = ['Yitzhak Abrabanel'];
    criteria.auctionHouseIds = ['house-1'];
    criteria.dateRange = { from: '2026-01-01', to: '2026-12-31' };
    criteria.price = { min: 500, max: 1200, currency: 'USD' };
    criteria.periods = ['15th century'];
    criteria.media = ['painting'];
    criteria.geography = ['Israel'];

    expect(criteriaToSearchRequest(criteria, 'en').filters).toEqual({
      categories: ['rare_books'],
      creators: ['Yitzhak Abrabanel'],
      auctionHouseIds: ['house-1'],
      geography: ['Israel'],
      media: ['painting'],
      periods: ['15th century'],
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
      price: { min: 500, max: 1200, currency: 'USD' },
    });
  });

  it('omits filters entirely when no criteria map to a lots-search-supported facet', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.keywords = ['rare'];
    criteria.periods = ['Renaissance'];
    criteria.geography = ['ישראל'];

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'rare',
      language: 'en',
    });
  });

  it('sends only the periods, places and media the lots search can read, deduplicated', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.periods = ['19th', '1890', 'המאה ה-19', 'Renaissance'];
    criteria.geography = ['ישראל', 'Israel'];
    criteria.media = ['oil on canvas', 'שמן על בד'];

    expect(criteriaToSearchRequest(criteria, 'he').filters).toEqual({
      geography: ['Israel'],
      media: ['oil on canvas'],
      periods: ['19th century'],
    });
    expect(unfilteredCriteria(criteria)).toEqual(['periods', 'geography', 'media']);
  });
});

describe('toSearchPeriod', () => {
  it.each([
    ['19th', '19th century'],
    ['19th century', '19th century'],
    ['1st', '1st century'],
    ['2nd', '2nd century'],
    ['3rd', '3rd century'],
    ['11th', '11th century'],
    ['21st', '21st century'],
    ['1890', '19th century'],
    ['1900', '19th century'],
    ['1901', '20th century'],
    ['2025', '21st century'],
  ])('converts %s to %s', (period, expected) => {
    expect(toSearchPeriod(period)).toBe(expected);
  });

  it.each(['Renaissance', 'המאה ה-19', '190', '19th-century art'])('does not send %s', (period) => {
    expect(toSearchPeriod(period)).toBeUndefined();
  });
});
