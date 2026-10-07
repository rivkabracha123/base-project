import { ValidationPipe } from '@nestjs/common';
import { LotSearchDto } from './lot-search.dto';

// Mirrors the global pipe configured in main.ts, so these tests exercise the
// exact validation the POST /api/lots/search body goes through in production.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validateBody = (body: unknown): Promise<LotSearchDto> =>
  pipe.transform(body, { type: 'body', metatype: LotSearchDto }) as Promise<LotSearchDto>;

describe('LotSearchDto', () => {
  it('accepts a minimal text-only search body', async () => {
    await expect(validateBody({ query: 'atereth zekeinim', language: 'en' })).resolves.toEqual({
      query: 'atereth zekeinim',
      language: 'en',
    });
  });

  it('accepts positive integer page and limit', async () => {
    await expect(validateBody({ page: 2, limit: 5 })).resolves.toMatchObject({ page: 2, limit: 5 });
  });

  it('coerces numeric strings for page and limit (query-string callers)', async () => {
    await expect(validateBody({ page: '3', limit: '20' })).resolves.toMatchObject({ page: 3, limit: 20 });
  });

  it('rejects page or limit below 1', async () => {
    await expect(validateBody({ page: 0 })).rejects.toThrow();
    await expect(validateBody({ limit: -5 })).rejects.toThrow();
  });

  it('rejects a non-integer page', async () => {
    await expect(validateBody({ page: 1.5 })).rejects.toThrow();
  });

  it('leaves page and limit undefined when omitted (service owns the default)', async () => {
    const result = await validateBody({ query: 'book' });
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
  });

  describe('filters — array facets', () => {
    it('accepts string-array facets', async () => {
      const result = await validateBody({
        filters: {
          categories: ['rare_books'],
          creators: ['yitzhak_abrabanel'],
          auctionHouseIds: ['house-kestenbaum'],
        },
      });
      expect(result.filters).toEqual({
        categories: ['rare_books'],
        creators: ['yitzhak_abrabanel'],
        auctionHouseIds: ['house-kestenbaum'],
      });
    });

    it('accepts an empty filters object', async () => {
      await expect(validateBody({ filters: {} })).resolves.toMatchObject({ filters: {} });
    });

    it('rejects a facet that is not an array', async () => {
      await expect(validateBody({ filters: { categories: 'rare_books' } })).rejects.toThrow();
    });

    it('rejects non-string elements in a facet', async () => {
      await expect(validateBody({ filters: { creators: [123] } })).rejects.toThrow();
    });

    it('rejects filters that is not an object', async () => {
      await expect(validateBody({ filters: 'rare_books' })).rejects.toThrow();
    });
  });

  describe('filters — dateRange', () => {
    it('accepts a full YYYY-MM-DD range', async () => {
      const result = await validateBody({
        filters: { dateRange: { from: '2025-01-01', to: '2025-12-31' } },
      });
      expect(result.filters?.dateRange).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    });

    it('accepts a single open-ended bound', async () => {
      await expect(
        validateBody({ filters: { dateRange: { from: '2025-01-01' } } }),
      ).resolves.toMatchObject({ filters: { dateRange: { from: '2025-01-01' } } });
    });

    it('rejects a non-ISO date', async () => {
      await expect(
        validateBody({ filters: { dateRange: { from: '01/2025' } } }),
      ).rejects.toThrow();
    });

    it('rejects a datetime (the contract is date-only, matching saleDate)', async () => {
      await expect(
        validateBody({ filters: { dateRange: { from: '2025-01-01T00:00:00Z' } } }),
      ).rejects.toThrow();
    });

    it('rejects an impossible calendar date', async () => {
      await expect(
        validateBody({ filters: { dateRange: { to: '2025-13-40' } } }),
      ).rejects.toThrow();
    });

    it('rejects an unknown key inside dateRange', async () => {
      await expect(
        validateBody({ filters: { dateRange: { on: '2025-01-01' } } }),
      ).rejects.toThrow();
    });
  });

  describe('filters — price', () => {
    it('accepts a full min/max/currency range', async () => {
      const result = await validateBody({
        filters: { price: { min: 800, max: 1500, currency: 'USD' } },
      });
      expect(result.filters?.price).toEqual({ min: 800, max: 1500, currency: 'USD' });
    });

    it('accepts a single open-ended bound with a currency', async () => {
      await expect(
        validateBody({ filters: { price: { max: 1500, currency: 'ILS' } } }),
      ).resolves.toMatchObject({ filters: { price: { max: 1500, currency: 'ILS' } } });
    });

    it('rejects a negative amount', async () => {
      await expect(
        validateBody({ filters: { price: { min: -5, currency: 'USD' } } }),
      ).rejects.toThrow();
    });

    it('rejects a non-numeric amount', async () => {
      await expect(
        validateBody({ filters: { price: { max: '1500', currency: 'USD' } } }),
      ).rejects.toThrow();
    });

    it('rejects a lowercase currency code', async () => {
      await expect(
        validateBody({ filters: { price: { max: 1500, currency: 'usd' } } }),
      ).rejects.toThrow();
    });

    it('rejects a currency that is not three letters', async () => {
      await expect(
        validateBody({ filters: { price: { max: 1500, currency: 'US' } } }),
      ).rejects.toThrow();
    });

    it('rejects an unknown key inside price', async () => {
      await expect(
        validateBody({ filters: { price: { max: 1500, curency: 'USD' } } }),
      ).rejects.toThrow();
    });
  });

  describe('filters — unsupported facets are rejected, not ignored', () => {
    // A filter the search does not implement must fail loudly, never be accepted
    // and silently dropped.
    it.each(['periods', 'media', 'geography'])(
      'rejects the unsupported facet %s',
      async (facet: string) => {
        await expect(validateBody({ filters: { [facet]: ['x'] } })).rejects.toThrow();
      },
    );

    it('rejects an unknown key at the top level', async () => {
      await expect(validateBody({ query: 'book', sort: 'price' })).rejects.toThrow();
    });
  });
});
