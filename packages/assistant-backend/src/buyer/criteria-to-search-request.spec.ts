import { criteriaToSearchRequest } from './criteria-to-search-request';

describe('criteriaToSearchRequest', () => {
  it('creates a basic text search request with caller-supplied language', () => {
    const criteria = {
      category: 'rare_books',
      creator: 'Yitzhak Abrabanel',
      period: '15th century',
      keywords: ['rare', 'Hebrew', 'books'],
      missing: [],
    };

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'Yitzhak Abrabanel rare Hebrew books',
      language: 'en',
    });
  });

  it('does not infer language from buyer criteria', () => {
    const criteria = { missing: [], category: 'rare_books' };

    expect(criteriaToSearchRequest(criteria, 'he')).toEqual({
      query: '',
      language: 'he',
    });
  });

  it('preserves the approved optional search criteria', () => {
    const criteria = {
      media: 'painting',
      geography: 'Israel',
      keywords: ['blue', 'modern'],
      budget: { min: 500, max: 1200 },
      missing: [],
    };

    expect(criteriaToSearchRequest(criteria, 'en')).toEqual({
      query: 'blue modern',
      language: 'en',
    });
  });
});
