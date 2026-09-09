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
    });
  });

  it('does not infer language from buyer criteria', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];

    expect(criteriaToSearchRequest(criteria, 'he')).toEqual({
      query: '',
      language: 'he',
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
    });
  });
});
