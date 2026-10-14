import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import type { LotFiltersDto, LotSearchDto } from './lot-search.dto';
import { LotsService } from './lots.service';

const payload = {
  id: 'lot-1',
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Lot', he: 'פריט' },
  description: { en: 'Description', he: 'תיאור' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold' as const,
  realizedPrice: { amount: 1200, currency: 'USD' },
};

describe('LotsService', () => {
  // Helper to create mock QueryBuilder supporting pagination chaining
  // Each method returns `this` so the service's fluent chain works; assertions
  // then inspect which clauses were added. `andWhere` carries the filter clauses.
  const createMockQueryBuilder = (entities: any[], total: number) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities, raw: [] }),
    getCount: jest.fn().mockResolvedValue(total),
  });

  // Minimal repository stub whose only job is to hand back the mock builder.
  const mockRepo = (queryBuilder: ReturnType<typeof createMockQueryBuilder>) =>
    ({ createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) }) as unknown as Repository<AuctionLotEntity>;

  // For searches that match nothing: the first query builder is the search itself,
  // every later one is the "which sent values exist on any lot" lookup, which
  // returns `knownValues` as its distinct tokens.
  const mockRepoWithKnownValues = (
    searchBuilder: ReturnType<typeof createMockQueryBuilder>,
    knownValues: string[],
  ) => {
    const knownValuesBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(knownValues.map((value) => ({ value }))),
    };
    return {
      createQueryBuilder: jest.fn().mockReturnValueOnce(searchBuilder).mockReturnValue(knownValuesBuilder),
    } as unknown as Repository<AuctionLotEntity>;
  };

  it('returns the first seeded fixture as the sample', async () => {
    const repository = { find: jest.fn().mockResolvedValue([{ payload }]) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findSample()).resolves.toEqual(payload);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' }, take: 1 });
  });

  it('returns paginated lot records whose English title matches the search text', async () => {
    const queryBuilder = createMockQueryBuilder([{ payload }], 1);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search({
      query: 'Atereth',
      language: 'en',
      page: 1,
      limit: 10,
    });

    // Verify paginated response structure
    expect(result).toEqual({
      data: [{ lot: payload, matchReasons: [] }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining(`LOWER(lot.payload->'title'->>'en') LIKE LOWER(:query)`),
      expect.objectContaining({ query: '%Atereth%' })
    );
  });

  it('returns empty paginated structure when the query is empty', async () => {
    const repository = {} as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search({
      query: '   ',
      language: 'en',
      page: 1,
      limit: 10,
    });

    // Expect empty PaginatedResult object
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('escapes literal percent and underscore characters and handles pagination parameters', async () => {
    const queryBuilder = createMockQueryBuilder([{ payload }], 1);
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search({
      query: '50% off_sale',
      language: 'en',
      page: 2,
      limit: 5,
    });

    // Verify offset calculation for page 2 with limit 5 -> skip(5)
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  // findOne returns the stored payload verbatim: realized price and source lineage are passed through, not remapped.
  it('hands historical sale prices and source lineage to consumers without remapping', async () => {
    const repository = { findOneBy: jest.fn().mockResolvedValue({ payload }) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findOne('lot-1')).resolves.toEqual(payload);
  });

  it('uses the standard not-found outcome', async () => {
    const repository = { findOneBy: jest.fn().mockResolvedValue(null) } as unknown as Repository<AuctionLotEntity>;
    await expect(new LotsService(repository).findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns chronological verified sale history for one itemKey', async () => {
    const olderSale = { ...payload, id: 'sale-older', itemKey: 'abrabanel_commentary', saleDate: '2023-04-12' };
    const newerSale = { ...payload, id: 'sale-newer', itemKey: 'abrabanel_commentary', saleDate: '2024-11-14' };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ payload: olderSale }, { payload: newerSale }]),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    await expect(new LotsService(repository).findSaleHistoryByItemKey('abrabanel_commentary'))
      .resolves.toEqual([olderSale, newerSale]);
    expect(queryBuilder.where).toHaveBeenCalledWith("lot.payload->>'itemKey' = :itemKey", {
      itemKey: 'abrabanel_commentary',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith("lot.payload->>'status' = :status", { status: 'sold' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith("lot.payload->'realizedPrice' IS NOT NULL");
    expect(queryBuilder.orderBy).toHaveBeenCalledWith("(lot.payload->>'saleDate')::date", 'ASC');
  });

  describe('full-text search (title/description)', () => {
    it('adds a PostgreSQL full-text match clause alongside the partial-text LIKE clause', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);
      const repository = mockRepo(queryBuilder);

      await new LotsService(repository).search({ query: 'Atereth', language: 'en' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(
          `to_tsvector('english', lot.payload->'title'->>'en') @@ plainto_tsquery('english', :ftsQuery)`
        ),
        expect.objectContaining({ ftsQuery: 'Atereth' }),
      );
    });
  });

  describe('structured filters', () => {
    // The list facets share one mechanism: an `IN` clause on a JSON path, added
    // via `andWhere` so it composes with (rather than replaces) the text search.
    // One case per facet also guards its JSON path against typos.
    it.each([
      ['categories', "lot.payload->>'category'", ['rare_books', 'manuscripts']],
      ['creators', "lot.payload->>'creator'", ["yitzhak_abrabanel", "o'brien"]],
      ['auctionHouseIds', "lot.payload->'auctionHouse'->>'id'", ['house-kestenbaum']],
      ['geography', "lot.payload->>'geography'", ['italy', 'israel']],
      ['media', "lot.payload->>'medium'", ['oil_on_canvas', 'printed_book']],
      ['statuses', "lot.payload->>'status'", ['sold', 'upcoming']],
      ['periods', "lot.payload->>'period'", ['16th_century', '20th_century']],
    ])('narrows on %s with a parameterized IN clause alongside the text query', async (facet: string, path: string, values: string[]) => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        query: 'atereth',
        filters: { [facet]: values },
      });

      // The SQL carries only the `:...name` placeholder; the values (a quote
      // among them) reach the driver verbatim through the params object.
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(`${path} IN (:...${facet})`),
        { [facet]: values },
      );
      // the text term is still matched — the filter narrows, it does not replace
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({ query: expect.stringContaining('atereth') }),
      );
    });

    // Every filter must count as a filter on its own: a search with no text that
    // carries only this one still reaches the database instead of short-circuiting.
    it.each([
      ['categories', { categories: ['rare_books'] }],
      ['creators', { creators: ['yitzhak_abrabanel'] }],
      ['auctionHouseIds', { auctionHouseIds: ['house-kestenbaum'] }],
      ['geography', { geography: ['italy'] }],
      ['media', { media: ['oil_on_canvas'] }],
      ['statuses', { statuses: ['sold'] }],
      ['periods', { periods: ['16th_century'] }],
      ['dateRange.from', { dateRange: { from: '2025-01-01' } }],
      ['dateRange.to', { dateRange: { to: '2025-12-31' } }],
      ['price.min', { price: { min: 100 } }],
      ['price.max', { price: { max: 1500 } }],
    ])('runs a search on the %s filter alone, without text', async (_name: string, filters: LotFiltersDto) => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({ filters });

      expect(queryBuilder.getRawAndEntities).toHaveBeenCalled();
    });

    describe('category and creator aliases', () => {
      it('resolves a category alias to its canonical token before building the IN clause', async () => {
        const queryBuilder = createMockQueryBuilder([{ payload }], 1);

        await new LotsService(mockRepo(queryBuilder)).search({
          filters: { categories: ['ספרים נדירים'] },
        });

        expect(queryBuilder.andWhere).toHaveBeenCalledWith(
          expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
          { categories: ['rare_books'] },
        );
      });

      it('resolves a creator alias to its canonical token before building the IN clause', async () => {
        const queryBuilder = createMockQueryBuilder([{ payload }], 1);

        await new LotsService(mockRepo(queryBuilder)).search({
          filters: { creators: ['יצחק אברבנאל'] },
        });

        expect(queryBuilder.andWhere).toHaveBeenCalledWith(
          expect.stringContaining("lot.payload->>'creator' IN (:...creators)"),
          { creators: ['yitzhak_abrabanel'] },
        );
      });

      it('resolves each value independently when a filter mixes an alias with an already-canonical token', async () => {
        const queryBuilder = createMockQueryBuilder([{ payload }], 1);

        await new LotsService(mockRepo(queryBuilder)).search({
          filters: { categories: ['Rare Books', 'rare_books'] },
        });

        expect(queryBuilder.andWhere).toHaveBeenCalledWith(
          expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
          { categories: ['rare_books', 'rare_books'] },
        );
      });

      it('still applies the category clause when it is unresolvable, even alongside another valid filter', async () => {
        const queryBuilder = createMockQueryBuilder([], 0);

        await new LotsService(mockRepoWithKnownValues(queryBuilder, [])).search({
          filters: { categories: ['zzz_unmapped_term'], auctionHouseIds: ['house-kestenbaum'] },
        });

        expect(queryBuilder.andWhere).toHaveBeenCalledWith(
          expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
          { categories: ['zzz_unmapped_term'] },
        );
      });
    });

    it('adds no filter clause when filters are absent', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({ query: 'atereth' });

      // only the text clause — no filter clauses
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.anything(),
      );
    });

    // Guards against invisible constraint-broadening: a clause using LIKE / regex
    // / wildcard would silently match beyond the exact token (e.g. `books` hitting
    // `rare_books`). Every filter clause must compare by set membership.
    it('never uses substring matching for token facets', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { categories: ['books'], creators: ['abarbanel'] },
      });

      for (const [sql] of queryBuilder.andWhere.mock.calls) {
        expect(sql).not.toMatch(/LIKE|ILIKE|~|%/i);
      }
    });

    it('bounds the sale date on both sides', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { dateRange: { from: '2025-01-01', to: '2025-12-31' } },
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('>= :dateFrom'),
        { dateFrom: '2025-01-01' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('<= :dateTo'),
        { dateTo: '2025-12-31' },
      );
    });

    it('applies only the date bound that is supplied', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { dateRange: { from: '2025-01-01' } },
      });

      const clauses = queryBuilder.andWhere.mock.calls.map((call: unknown[]) => call[0]).join(' ');
      expect(clauses).toContain('>= :dateFrom');
      expect(clauses).not.toContain(':dateTo');
    });

    // Amounts are compared as-is, across currencies: no conversion, and no
    // currency filter, so a lot priced in another currency is still in scope.
    it('filters realized price by amount, ignoring the currency', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { price: { min: 500, max: 1500, currency: 'USD' } },
      });

      const [sql, params] = queryBuilder.andWhere.mock.calls[0];
      expect(sql).toContain("realizedPrice'->>'amount')::numeric >= :priceMin");
      expect(sql).toContain("realizedPrice'->>'amount')::numeric <= :priceMax");
      expect(sql).not.toContain(':priceCurrency');
      expect(params).toEqual({ priceMin: 500, priceMax: 1500 });
    });

    it('applies only the price bound that is supplied', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { price: { max: 1500, currency: 'USD' } },
      });

      const [sql, params] = queryBuilder.andWhere.mock.calls[0];
      expect(sql).toContain('<= :priceMax');
      expect(sql).not.toContain(':priceMin');
      expect(params).toEqual({ priceMax: 1500 });
    });

    it('falls back to the estimate band for lots with no realized price', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { price: { min: 500, max: 1500, currency: 'USD' } },
      });

      const [sql] = queryBuilder.andWhere.mock.calls[0];
      expect(sql).toContain("realizedPrice' IS NULL");
      expect(sql).toContain("estimate' IS NOT NULL");
      // The estimate band [low, high] must overlap the requested [min, max].
      expect(sql).toContain("estimate'->'high'->>'amount')::numeric >= :priceMin");
      expect(sql).toContain("estimate'->'low'->>'amount')::numeric <= :priceMax");
      expect(sql).toMatch(/\bOR\b/);
    });

    // A search carrying filters but no text still runs; a filtered search that
    // matches nothing returns an honest empty result — the filter is never
    // dropped to surface something.
    it('runs a filter-only search and reports an honest empty result', async () => {
      const queryBuilder = createMockQueryBuilder([], 0);

      const result = await new LotsService(mockRepoWithKnownValues(queryBuilder, [])).search({
        filters: { categories: ['no_such_category'] },
      });

      expect(queryBuilder.getRawAndEntities).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('IN (:...categories)'),
        { categories: ['no_such_category'] },
      );
      // no text to match, so only recency and the id tie-break order the rows
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('sale_date', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('lot.id', 'ASC');
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        unrecognizedFilters: { categories: ['no_such_category'] },
      });
    });
  });

  describe('deterministic ranking', () => {
    it('orders title matches before description-only matches, then recency, then id', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({ query: 'Abrabanel' });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('title_match', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(1, 'description_match', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'sale_date', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(3, 'lot.id', 'ASC');
    });

    // Ranking is only an ORDER BY: if a ranking column ever reached the WHERE
    // clause it could drop or add rows and weaken a strict filter.
    it('keeps the ranking columns out of the WHERE clause so strict filters stay strict', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        query: 'Abrabanel',
        filters: { price: { max: 1500, currency: 'USD' } },
      });

      const where = queryBuilder.andWhere.mock.calls.map((call: unknown[]) => call[0]).join(' ');
      expect(where).toContain('<= :priceMax');
      expect(where).not.toMatch(/title_match|description_match|sale_date/);
    });

    it('adds no text-match columns when there is no text to match', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({ filters: { categories: ['rare_books'] } });

      const aliases = queryBuilder.addSelect.mock.calls.map((call: unknown[]) => call[1]);
      expect(aliases).not.toContain('title_match');
      expect(aliases).not.toContain('description_match');
      expect(aliases).toContain('sale_date');
    });

    it.each([
      ['with text', { query: 'Abrabanel' }],
      ['without text', { filters: { categories: ['rare_books'] } }],
    ])('always ends the order with the lot id tie-break %s', async (_label: string, criteria: LotSearchDto) => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search(criteria);

      const calls = queryBuilder.addOrderBy.mock.calls;
      expect(calls[calls.length - 1]).toEqual(['lot.id', 'ASC']);
    });
  });

  describe('match reasons', () => {
    // The title/description flags come back as raw columns next to each entity, so
    // the reason reports where the text matched, as decided by the SQL itself.
    it('reports a title match for a lot whose title matched the text', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ title_match: 1, description_match: 0 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({ query: 'Lot' });

      expect(result.data).toEqual([
        { lot: payload, matchReasons: [{ field: 'query', detail: 'title' }] },
      ]);
    });

    it('reports a description match for a lot whose description matched but its title did not', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ title_match: 0, description_match: 1 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({ query: 'Description' });

      expect(result.data).toEqual([
        { lot: payload, matchReasons: [{ field: 'query', detail: 'description' }] },
      ]);
    });

    it('reports both a title and a description match, title first', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ title_match: 1, description_match: 1 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({ query: 'Lot' });

      expect(result.data).toEqual([
        {
          lot: payload,
          matchReasons: [
            { field: 'query', detail: 'title' },
            { field: 'query', detail: 'description' },
          ],
        },
      ]);
    });

    it('reports no query reason when the free text matched neither field', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ title_match: 0, description_match: 0 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({ query: 'Lot' });

      expect(result.data).toEqual([{ lot: payload, matchReasons: [] }]);
    });

    // For a list filter the SQL returns the position of the sent value the lot
    // matched; the reason reports that value as it was sent, not its token.
    it('reports the categories value, as sent, that the lot matched', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ categories_position: 1 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({
        filters: { categories: ['Old Maps', 'ספרים נדירים'] },
      });

      expect(result.data).toEqual([
        { lot: payload, matchReasons: [{ field: 'categories', detail: 'ספרים נדירים' }] },
      ]);
    });

    it.each(['creators', 'auctionHouseIds', 'geography', 'media', 'statuses', 'periods'] as const)(
      'reports the %s value, as sent, that the lot matched',
      async (facet) => {
        const queryBuilder = {
          ...createMockQueryBuilder([], 0),
          getRawAndEntities: jest.fn().mockResolvedValue({
            entities: [{ payload }],
            raw: [{ [`${facet}_position`]: 1 }],
          }),
          getCount: jest.fn().mockResolvedValue(1),
        };

        const result = await new LotsService(mockRepo(queryBuilder)).search({
          filters: { [facet]: ['First Value', 'Second Value'] },
        });

        expect(result.data).toEqual([
          { lot: payload, matchReasons: [{ field: facet, detail: 'Second Value' }] },
        ]);
      },
    );

    it('lists the query reasons first, then the filter reasons in the filters declaration order', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ title_match: 1, description_match: 1, periods_position: 0, categories_position: 0 }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({
        query: 'Lot',
        filters: { periods: ['16th century'], categories: ['rare_books'] },
      });

      expect(result.data[0]?.matchReasons.map((reason) => reason.field)).toEqual([
        'query',
        'query',
        'categories',
        'periods',
      ]);
    });

    // The reason reads the sent value at the position the SQL returns, so the
    // CASE branches must follow the order of the sent values.
    it('numbers the CASE branches in the order the values were sent', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      await new LotsService(mockRepo(queryBuilder)).search({
        filters: { categories: ['Old Maps', 'ספרים נדירים'] },
      });

      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringMatching(/:categories_0 THEN 0 WHEN .* = :categories_1 THEN 1 END/),
        'categories_position',
      );
      expect(queryBuilder.setParameters).toHaveBeenCalledWith({
        categories_0: 'old_maps',
        categories_1: 'rare_books',
      });
    });

    // Every returned lot is inside the strict date window, so the reason only
    // restates the window as it was sent; an open end is left empty.
    it.each([
      ['both bounds', { from: '2026-10-01', to: '2026-12-31' }, '2026-10-01..2026-12-31'],
      ['only a start', { from: '2026-10-01' }, '2026-10-01..'],
      ['only an end', { to: '2026-12-31' }, '..2026-12-31'],
    ])('reports the dateRange as sent when it has %s', async (_label, dateRange, detail) => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      const result = await new LotsService(mockRepo(queryBuilder)).search({ filters: { dateRange } });

      expect(result.data).toEqual([{ lot: payload, matchReasons: [{ field: 'dateRange', detail }] }]);
    });

    it('reports no dateRange reason when no date bound was sent', async () => {
      const queryBuilder = createMockQueryBuilder([{ payload }], 1);

      const result = await new LotsService(mockRepo(queryBuilder)).search({
        filters: { categories: ['rare_books'] },
      });

      expect(result.data[0]?.matchReasons.map((reason) => reason.field)).not.toContain('dateRange');
    });

    // Price is matched on the realized price when the lot has one, else on its
    // estimate band; the SQL says which, so the rule lives in one place.
    it.each(['realized', 'estimate'])('reports the %s price basis the SQL chose', async (basis) => {
      const queryBuilder = {
        ...createMockQueryBuilder([], 0),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ payload }],
          raw: [{ price_basis: basis }],
        }),
        getCount: jest.fn().mockResolvedValue(1),
      };

      const result = await new LotsService(mockRepo(queryBuilder)).search({
        filters: { price: { min: 1000, max: 1500, currency: 'USD' } },
      });

      expect(result.data).toEqual([
        { lot: payload, matchReasons: [{ field: 'price', detail: basis }] },
      ]);
    });
  });

  describe('unrecognized filters', () => {
    // On an empty result, a sent value whose token exists on no lot at all is
    // reported as sent, so the caller can tell "no such value" from "no match".
    it('reports a sent categories value that exists on no lot, as sent, when nothing matched', async () => {
      const searchBuilder = createMockQueryBuilder([], 0);
      const knownValuesBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'rare_books' }]),
      };
      const repository = {
        createQueryBuilder: jest.fn().mockReturnValueOnce(searchBuilder).mockReturnValueOnce(knownValuesBuilder),
      } as unknown as Repository<AuctionLotEntity>;

      const result = await new LotsService(repository).search({
        filters: { categories: ['Old Maps', 'Rare Books'] },
      });

      expect(result.data).toEqual([]);
      expect(result.unrecognizedFilters).toEqual({ categories: ['Old Maps'] });
    });

    it('reports every unknown value of a facet, in the order they were sent', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), ['rare_books']);

      const result = await new LotsService(repository).search({
        filters: { categories: ['Old Maps', 'Rare Books', 'Sculptures'] },
      });

      expect(result.unrecognizedFilters).toEqual({ categories: ['Old Maps', 'Sculptures'] });
    });

    it('does not report a value that exists on some lot but matched nothing in this search', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), ['rare_books']);

      const result = await new LotsService(repository).search({ filters: { categories: ['Rare Books'] } });

      expect(result.data).toEqual([]);
      expect(result).not.toHaveProperty('unrecognizedFilters');
    });

    it('checks the token a Hebrew alias resolves to, not the Hebrew text', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), ['rare_books']);

      const result = await new LotsService(repository).search({ filters: { categories: ['ספרים נדירים'] } });

      expect(result).not.toHaveProperty('unrecognizedFilters');
    });

    it.each(['creators', 'auctionHouseIds', 'geography', 'media', 'periods'] as const)(
      'reports an unknown %s value as sent',
      async (facet) => {
        const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), []);

        const result = await new LotsService(repository).search({ filters: { [facet]: ['Unknown One'] } });

        expect(result.unrecognizedFilters).toEqual({ [facet]: ['Unknown One'] });
      },
    );

    it('lists each facet that has unknown values and leaves out the others', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), []);

      const result = await new LotsService(repository).search({
        filters: { categories: ['Old Maps'], creators: ['Monet'], price: { min: 1, max: 2 } },
      });

      expect(result.unrecognizedFilters).toEqual({ categories: ['Old Maps'], creators: ['Monet'] });
    });

    it('does not look up statuses, which the request validation already restricts', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), []);

      const result = await new LotsService(repository).search({ filters: { statuses: ['sold'] } });

      expect(result).not.toHaveProperty('unrecognizedFilters');
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('adds nothing and runs no lookup when the search found lots', async () => {
      const repository = mockRepo(createMockQueryBuilder([{ payload }], 1));

      const result = await new LotsService(repository).search({ filters: { categories: ['Old Maps'] } });

      expect(result).not.toHaveProperty('unrecognizedFilters');
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('adds nothing when an empty search sent no list filter', async () => {
      const repository = mockRepoWithKnownValues(createMockQueryBuilder([], 0), []);

      const result = await new LotsService(repository).search({ query: 'nothing matches this' });

      expect(result).not.toHaveProperty('unrecognizedFilters');
      expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    });
  });
});
