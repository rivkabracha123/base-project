import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { resolveCategoryAlias, resolveCreatorAlias } from './lot-alias';
import type { LotFiltersDto, LotSearchDto } from './lot-search.dto';

function hasAnyFilter(filters?: LotFiltersDto): boolean {
  if (!filters) return false;
  return Boolean(
    filters.categories?.length ||
      filters.creators?.length ||
      filters.auctionHouseIds?.length ||
      filters.dateRange?.from ||
      filters.dateRange?.to ||
      filters.price?.min != null ||
      filters.price?.max != null,
  );
}

@Injectable()
export class LotsService {
  // Reads canonical lots from the database without remapping source metadata.
  constructor(
    @InjectRepository(AuctionLotEntity)
    private readonly lots: Repository<AuctionLotEntity>,
  ) {}

  // Returns the earliest valid fixture lot as a stable sample payload.
  async findSample(): Promise<AuctionLot> {
    const [entity] = await this.lots.find({ order: { createdAt: 'ASC' }, take: 1 });
    if (!entity) throw new NotFoundException('No fixture lots are available');
    return entity.payload;
  }

  // Paginated auction-lot search: the free-text term and the structured filters
  // narrow the same query.
  async search(criteria: LotSearchDto): Promise<PaginatedResult<AuctionLot>> {
    const { query = '', page = 1, limit = 10, filters } = criteria;
    const normalizedQuery = query.trim();

    // Nothing to search on — no text and no filter — yields an empty page
    // without touching the database.
    if (!normalizedQuery && !hasAnyFilter(filters)) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const qb = this.lots.createQueryBuilder('lot');

    // Free-text match over the bilingual title and description, two ways: a
    // partial (substring) match and a Postgres full-text match, OR'd together
    // so either one finding the lot is enough. `%` / `_` in the LIKE term are
    // escaped so they match literally (e.g. "25%"); the full-text side takes
    // the unescaped term since `plainto_tsquery` has its own tokenizing, not
    // LIKE wildcard semantics. Hebrew has no built-in Postgres dictionary, so
    // its full-text config is `simple` (tokenizes only, no stemming) while
    // English uses `english` (stemmed).
    if (normalizedQuery) {
      const escapedQuery = normalizedQuery.replace(/[\\%_]/g, (char) => `\\${char}`);
      qb.andWhere(
        `(
          LOWER(lot.payload->'title'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'title'->>'he') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'he') LIKE LOWER(:query) ESCAPE '\\' OR
          to_tsvector('english', lot.payload->'title'->>'en') @@ plainto_tsquery('english', :ftsQuery) OR
          to_tsvector('simple', lot.payload->'title'->>'he') @@ plainto_tsquery('simple', :ftsQuery) OR
          to_tsvector('english', lot.payload->'description'->>'en') @@ plainto_tsquery('english', :ftsQuery) OR
          to_tsvector('simple', lot.payload->'description'->>'he') @@ plainto_tsquery('simple', :ftsQuery)
        )`,
        { query: `%${escapedQuery}%`, ftsQuery: normalizedQuery }
      );
    }

    // Each populated list facet adds an `IN` clause on its JSON path. Values are
    // bound parameters, never interpolated. Empty arrays are skipped: `IN ()` is
    // invalid SQL. Category and creator values pass through their alias resolver
    // first; a value with no curated alias is kept as-is rather than dropped, so
    // the clause is never silently skipped.
    const listFacets: ReadonlyArray<
      ['categories' | 'creators' | 'auctionHouseIds', string, ((value: string) => string | undefined) | undefined]
    > = [
      ['categories', "lot.payload->>'category'", resolveCategoryAlias],
      ['creators', "lot.payload->>'creator'", resolveCreatorAlias],
      ['auctionHouseIds', "lot.payload->'auctionHouse'->>'id'", undefined],
    ];
    for (const [key, path, resolve] of listFacets) {
      const rawValues = filters?.[key];
      if (rawValues?.length) {
        const values = resolve ? rawValues.map((value) => resolve(value) ?? value) : rawValues;
        qb.andWhere(`${path} IN (:...${key})`, { [key]: values });
      }
    }

    // Sale-date window. `saleDate` is stored as JSON text; cast it to `date` so
    // the bounds compare as dates. Either bound may be omitted.
    if (filters?.dateRange?.from) {
      qb.andWhere("(lot.payload->>'saleDate')::date >= :dateFrom", { dateFrom: filters.dateRange.from });
    }
    if (filters?.dateRange?.to) {
      qb.andWhere("(lot.payload->>'saleDate')::date <= :dateTo", { dateTo: filters.dateRange.to });
    }

    // Price window. A sold lot is matched on its realized price; a lot without
    // one is matched when its estimate band [low, high] overlaps the requested
    // range. A lot with neither is excluded. Amounts are compared as-is — the
    // request currency is not used to convert or to exclude other-currency lots.
    // Amounts are stored as JSON text, hence the `::numeric` cast.
    const price = filters?.price;
    if (price && (price.min != null || price.max != null)) {
      const realized = ["lot.payload->'realizedPrice' IS NOT NULL"];
      const estimate = [
        "lot.payload->'realizedPrice' IS NULL",
        "lot.payload->'estimate' IS NOT NULL",
      ];
      const priceParams: Record<string, unknown> = {};
      if (price.min != null) {
        realized.push("(lot.payload->'realizedPrice'->>'amount')::numeric >= :priceMin");
        estimate.push("(lot.payload->'estimate'->'high'->>'amount')::numeric >= :priceMin");
        priceParams.priceMin = price.min;
      }
      if (price.max != null) {
        realized.push("(lot.payload->'realizedPrice'->>'amount')::numeric <= :priceMax");
        estimate.push("(lot.payload->'estimate'->'low'->>'amount')::numeric <= :priceMax");
        priceParams.priceMax = price.max;
      }
      qb.andWhere(`((${realized.join(' AND ')}) OR (${estimate.join(' AND ')}))`, priceParams);
    }

    // Calculate pagination parameters
    const offset = (page - 1) * limit;

    // A stable, deterministic order so pages never overlap or drop rows.
    // Relevance ranking replaces this ordering in a later week; the tie-break
    // on the primary key must remain regardless.
    qb.orderBy('lot.id', 'ASC');

    // Apply pagination and fetch items with total matching count
    const [entities, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      data: entities.map((entity) => entity.payload),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<AuctionLot> {
    const entity = await this.lots.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Auction lot ${id} was not found`);
    return entity.payload;
  }

  // Returns verified past sales linked to one item. itemKey joins separate auction
  // records that represent the same item across different sales.
  async findSaleHistoryByItemKey(itemKey: string): Promise<AuctionLot[]> {
    const entities = await this.lots
      .createQueryBuilder('lot')
      .where("lot.payload->>'itemKey' = :itemKey", { itemKey })
      .andWhere("lot.payload->>'status' = :status", { status: 'sold' })
      .andWhere("lot.payload->'realizedPrice' IS NOT NULL")
      .orderBy("(lot.payload->>'saleDate')::date", 'ASC')
      .getMany();

    return entities.map((entity) => entity.payload);
  }
}
