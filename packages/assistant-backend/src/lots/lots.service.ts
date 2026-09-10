import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
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

    // Free-text match over the bilingual title and description. `%` / `_` in the
    // term are escaped so they match literally (e.g. "25%").
    if (normalizedQuery) {
      const escapedQuery = normalizedQuery.replace(/[\\%_]/g, (char) => `\\${char}`);
      qb.andWhere(
        `(
          LOWER(lot.payload->'title'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'title'->>'he') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'en') LIKE LOWER(:query) ESCAPE '\\' OR
          LOWER(lot.payload->'description'->>'he') LIKE LOWER(:query) ESCAPE '\\'
        )`,
        { query: `%${escapedQuery}%` }
      );
    }

    // Each populated list facet adds an `IN` clause on its JSON path. Values are
    // bound parameters, never interpolated. Empty arrays are skipped: `IN ()` is
    // invalid SQL.
    const listFacets: ReadonlyArray<['categories' | 'creators' | 'auctionHouseIds', string]> = [
      ['categories', "lot.payload->>'category'"],
      ['creators', "lot.payload->>'creator'"],
      ['auctionHouseIds', "lot.payload->'auctionHouse'->>'id'"],
    ];
    for (const [key, path] of listFacets) {
      const values = filters?.[key];
      if (values?.length) {
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
}