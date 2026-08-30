import { BuyerSearchService } from './buyer-search.service';

describe('BuyerSearchService', () => {
  it('converts buyer criteria into a search request', () => {
    const service = new BuyerSearchService();

    const criteria = {
      category: 'rare_books',
      creator: 'Yitzhak Abrabanel',
      budgetMax: 1000,
      language: 'he' as const,
    };

    expect(service.createSearchRequest(criteria)).toEqual({
      category: 'rare_books',
      creator: 'Yitzhak Abrabanel',
      maxPrice: 1000,
      language: 'he',
    });
  });
});