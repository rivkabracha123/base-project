import { criteriaToSearchRequest } from './criteria-to-search-request';

describe('criteriaToSearchRequest', () => {
  it('converts buyer criteria into a search request', () => {
    const criteria = {
      category: 'rare_books',
      creator: 'Yitzhak Abrabanel',
      period: '17th century',
      budgetMax: 1000,
      language: 'he' as const,
    };

    expect(criteriaToSearchRequest(criteria)).toEqual({
      category: 'rare_books',
      creator: 'Yitzhak Abrabanel',
      period: '17th century',
      maxPrice: 1000,
      language: 'he',
    });
  });

  it('preserves strict budget constraints', () => {
    const criteria = {
      category: 'rare_books',
      budgetMax: 1000,
      language: 'he' as const,
    };

    const request = criteriaToSearchRequest(criteria);

    expect(request.maxPrice).toBe(1000);
  });

  it('does not invent missing criteria', () => {
    const criteria = {
      category: 'rare_books',
      language: 'he' as const,
    };

    const request = criteriaToSearchRequest(criteria);

    expect(request.creator).toBeUndefined();
    expect(request.period).toBeUndefined();
    expect(request.maxPrice).toBeUndefined();
  });
});

it('preserves all optional search criteria', () => {
  const criteria = {
    format: 'manuscript',
    geography: 'Israel',
    keywords: ['Hebrew', 'rare'],
    auctionHouse: 'Kestenbaum & Company',
    language: 'en' as const,
  };

  expect(criteriaToSearchRequest(criteria)).toEqual({
    format: 'manuscript',
    geography: 'Israel',
    keywords: ['Hebrew', 'rare'],
    auctionHouse: 'Kestenbaum & Company',
    language: 'en',
  });
});