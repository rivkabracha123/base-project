import type { LotsService } from '../lots/lots.service';
import { InvalidLotsSearchRequestError, LotsServiceSearchClient } from './lots-service-search.client';
import type { SearchRequest } from './search-request';

// Lots service stand-in that records what reached it.
function fakeLots() {
  const search = jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  return { lots: { search } as unknown as LotsService, search };
}

describe('LotsServiceSearchClient', () => {
  it('passes a valid request to the lots search with fixed first-page pagination', async () => {
    const { lots, search } = fakeLots();
    const request: SearchRequest = {
      query: 'abrabanel',
      language: 'en',
      filters: { categories: ['rare_books'], price: { min: 900, max: 1300, currency: 'USD' } },
    };

    await new LotsServiceSearchClient(lots).search(request);

    expect(search).toHaveBeenCalledWith({ ...request, page: 1, limit: 50 });
  });

  it.each<[string, SearchRequest['filters'], string[]]>([
    ['a negative budget', { price: { min: -100, max: 500 } }, ['filters.price.min']],
    ['a non-ISO currency', { price: { max: 500, currency: '$' } }, ['filters.price.currency']],
    ['an impossible date', { dateRange: { from: '2025-13-40' } }, ['filters.dateRange.from']],
    ['a date with a time', { dateRange: { to: '2025-01-01T10:00:00Z' } }, ['filters.dateRange.to']],
  ])('rejects %s before it reaches the lots search', async (_name, filters, fields) => {
    const { lots, search } = fakeLots();

    const attempt = new LotsServiceSearchClient(lots).search({ query: '', language: 'en', filters });

    await expect(attempt).rejects.toBeInstanceOf(InvalidLotsSearchRequestError);
    await expect(attempt).rejects.toMatchObject({ fields });
    expect(search).not.toHaveBeenCalled();
  });

  it('names the invalid field but never echoes the buyer value in the error', async () => {
    const { lots } = fakeLots();

    const error = (await new LotsServiceSearchClient(lots)
      .search({ query: '', language: 'en', filters: { price: { min: -987654 } } })
      .catch((caught: Error) => caught)) as Error;

    expect(error.message).toContain('filters.price.min');
    expect(error.message).not.toContain('987654');
  });

  it('leaves an inverted budget to the lots search unchanged rather than repairing it', async () => {
    const { lots, search } = fakeLots();
    const filters = { price: { min: 1500, max: 900, currency: 'USD' } };

    await new LotsServiceSearchClient(lots).search({ query: '', language: 'en', filters });

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ filters }));
  });
});
