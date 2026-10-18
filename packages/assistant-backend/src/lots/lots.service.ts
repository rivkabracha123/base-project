import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuctionLot, MatchReason } from '@monabid/shared';
import { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import {
  resolveCategoryAlias,
  resolveCreatorAlias,
  resolveGeographyAlias,
  resolveMediaAlias,
  resolvePeriodAlias,
} from './lot-alias';
import type { ListFacet, LotSearchResult, UnrecognizedFilters } from './lot-match';
import { splitQueryTerms } from './lot-query-terms';
import type { LotFiltersDto, LotSearchDto } from './lot-search.dto';

// Share of the query words a lot must match to be returned, rounded up (3 words need 2).
const MIN_MATCHED_WORDS_RATIO = 0.5;

function hasAnyFilter(filters?: LotFiltersDto): boolean {
  if (!filters) return false;
  return Boolean(
    filters.categories?.length ||
      filters.creators?.length ||
      filters.auctionHouseIds?.length ||
      filters.geography?.length ||
      filters.media?.length ||
      filters.statuses?.length ||
      filters.periods?.length ||
      filters.dateRange?.from ||
      filters.dateRange?.to ||
      filters.price?.min != null ||
      filters.price?.max != null,
  );
}

// A lot matches a field when the partial (LIKE) or the full-text condition finds
// the word in its English or Hebrew text. The word is bound as `:like<index>` (with
// LIKE wildcards) and `:fts<index>` (plain). Used by both the filter and the ranking,
// so a returned lot always gets a consistent rank.
function textMatch(field: 'title' | 'description', index: number): string {
  return `(
    LOWER(lot.payload->'${field}'->>'en') LIKE LOWER(:like${index}) ESCAPE '\\' OR
    LOWER(lot.payload->'${field}'->>'he') LIKE LOWER(:like${index}) ESCAPE '\\' OR
    to_tsvector('english', lot.payload->'${field}'->>'en') @@ plainto_tsquery('english', :fts${index}) OR
    to_tsvector('simple', lot.payload->'${field}'->>'he') @@ plainto_tsquery('simple', :fts${index})
  )`;
}

// A word matches a lot when it is found in the title or in the description.
function wordMatch(index: number): string {
  return `(${textMatch('title', index)} OR ${textMatch('description', index)})`;
}

// The SQL returns a `word_match_<index>` flag per query word on each raw row; a
// flagged word is reported as it was sent. The flags are absent when there was no
// free text, so no reason is reported then.
function queryReasons(row: Record<string, unknown> | undefined, terms: string[]): MatchReason[] {
  return terms
    .filter((_, index) => Number(row?.[`word_match_${index}`]) === 1)
    .map((term) => ({ field: 'query', detail: term }));
}

// A list filter that was sent: its values as sent, and the tokens they resolve to.
interface SentFacet {
  key: ListFacet;
  path: string;
  rawValues: string[];
  values: string[];
}

// For each list filter that was sent, the SQL returns the position of the sent
// value the lot matched; report that value as it was sent (not its token).
function facetReasons(
  row: Record<string, unknown> | undefined,
  filters: LotFiltersDto | undefined,
  facetKeys: ListFacet[],
): MatchReason[] {
  const reasons: MatchReason[] = [];
  for (const key of facetKeys) {
    const position = row?.[`${key}_position`];
    const detail = typeof position === 'number' ? filters?.[key]?.[position] : undefined;
    if (detail !== undefined) reasons.push({ field: key, detail });
  }
  return reasons;
}

// Every returned lot is inside the strict date window, so the reason restates the
// window as it was sent; an open end is left empty.
function dateRangeReasons(filters: LotFiltersDto | undefined): MatchReason[] {
  const { from, to } = filters?.dateRange ?? {};
  return from || to ? [{ field: 'dateRange', detail: `${from ?? ''}..${to ?? ''}` }] : [];
}

// The SQL says whether the price matched on the realized price or on the estimate.
function priceReasons(row: Record<string, unknown> | undefined): MatchReason[] {
  const basis = row?.price_basis;
  return typeof basis === 'string' ? [{ field: 'price', detail: basis }] : [];
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
  async search(criteria: LotSearchDto): Promise<LotSearchResult> {
    const { query = '', page = 1, limit = 10, filters } = criteria;
    const normalizedQuery = query.trim();
    const terms = splitQueryTerms(normalizedQuery);

    // Nothing to search on — no text and no filter — yields an empty page
    // without touching the database.
    if (!terms.length && !hasAnyFilter(filters)) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const qb = this.lots.createQueryBuilder('lot');

    // SQL expression counting how many of the query words match the lot; used by
    // both the filter and the ranking.
    const matchedWords = terms.map((_, index) => `CASE WHEN ${wordMatch(index)} THEN 1 ELSE 0 END`).join(' + ');

    // Each word is matched on its own, by partial (LIKE) or full-text match, in the
    // title or description. A lot is returned when at least half of the words
    // (rounded up) match. LIKE words are escaped so `%` and `_` match literally;
    // Hebrew full-text uses `simple` since Postgres has no Hebrew dictionary.
    if (terms.length) {
      const wordParams: Record<string, string | number> = { requiredMatches: Math.ceil(terms.length * MIN_MATCHED_WORDS_RATIO) };
      terms.forEach((term, index) => {
        wordParams[`like${index}`] = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        wordParams[`fts${index}`] = term;
      });
      qb.andWhere(`(${matchedWords}) >= :requiredMatches`, wordParams);
    }

    // Each populated list facet adds an `IN` clause on its JSON path. Values are
    // bound parameters, never interpolated. Empty arrays are skipped: `IN ()` is
    // invalid SQL. Category and creator values pass through their alias resolver
    // first; a value with no curated alias is kept as-is rather than dropped, so
    // the clause is never silently skipped.
    const listFacets: ReadonlyArray<
      [
        ListFacet,
        string,
        ((value: string) => string | undefined) | undefined,
      ]
    > = [
      ['categories', "lot.payload->>'category'", resolveCategoryAlias],
      ['creators', "lot.payload->>'creator'", resolveCreatorAlias],
      ['auctionHouseIds', "lot.payload->'auctionHouse'->>'id'", undefined],
      ['geography', "lot.payload->>'geography'", resolveGeographyAlias],
      ['media', "lot.payload->>'medium'", resolveMediaAlias],
      ['statuses', "lot.payload->>'status'", undefined],
      ['periods', "lot.payload->>'period'", resolvePeriodAlias],
    ];
    const sentFacets: SentFacet[] = [];
    for (const [key, path, resolve] of listFacets) {
      const rawValues = filters?.[key];
      if (rawValues?.length) {
        const values = resolve ? rawValues.map((value) => resolve(value) ?? value) : rawValues;
        sentFacets.push({ key, path, rawValues, values });
        qb.andWhere(`${path} IN (:...${key})`, { [key]: values });
        // Also select the position of the sent value this lot matched, for its
        // match reason. Each value is its own bound parameter, never interpolated.
        const branches = values.map((_, position) => `WHEN ${path} = :${key}_${position} THEN ${position}`);
        qb.addSelect(`CASE ${branches.join(' ')} END`, `${key}_position`);
        qb.setParameters(Object.fromEntries(values.map((value, position) => [`${key}_${position}`, value])));
      }
    }
    const facetKeys = listFacets.map(([key]) => key);

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
      // Which of the two rules above matched this lot, for its match reason.
      qb.addSelect(
        "CASE WHEN lot.payload->'realizedPrice' IS NOT NULL THEN 'realized' ELSE 'estimate' END",
        'price_basis',
      );
    }

    // Calculate pagination parameters
    const offset = (page - 1) * limit;

    // Ranking only orders rows that already passed the filters, never adds or drops
    // one. Most matched words first, then newest sale, then id so the order is
    // identical on every run.
    const ranking: Array<[string, 'ASC' | 'DESC']> = [];
    if (terms.length) {
      qb.addSelect(`(${matchedWords})`, 'matched_words');
      terms.forEach((_, index) =>
        qb.addSelect(`CASE WHEN ${wordMatch(index)} THEN 1 ELSE 0 END`, `word_match_${index}`),
      );
      ranking.push(['matched_words', 'DESC']);
    }
    qb.addSelect("lot.payload->>'saleDate'", 'sale_date');
    ranking.push(['sale_date', 'DESC'], ['lot.id', 'ASC']);
    ranking.forEach(([column, direction], index) =>
      index === 0 ? qb.orderBy(column, direction) : qb.addOrderBy(column, direction),
    );

    // Apply pagination and fetch the page with its raw rows (which carry the
    // text-match flags), then the total matching count.
    const { entities, raw } = await qb
      .skip(offset)
      .take(limit)
      .getRawAndEntities();
    const total = await qb.getCount();
    // Only an empty result needs to tell "no such value" from "no match".
    const unrecognizedFilters = total === 0 ? await this.findUnrecognized(sentFacets) : undefined;

    return {
      data: entities.map((entity, index) => ({
        lot: entity.payload,
        matchReasons: [
          ...queryReasons(raw[index], terms),
          ...facetReasons(raw[index], filters, facetKeys),
          ...dateRangeReasons(filters),
          ...priceReasons(raw[index]),
        ],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ...(unrecognizedFilters && { unrecognizedFilters }),
    };
  }

  // A sent value is unrecognized when its token exists on no lot at all, however
  // the other filters combine. Values are reported as sent, never as tokens.
  // `statuses` is skipped: the request validation already rejects unknown ones.
  private async findUnrecognized(sentFacets: SentFacet[]): Promise<UnrecognizedFilters | undefined> {
    const unrecognized: UnrecognizedFilters = {};
    for (const { key, path, rawValues, values } of sentFacets) {
      if (key === 'statuses') continue;
      const rows = await this.lots
        .createQueryBuilder('lot')
        .select(`DISTINCT ${path}`, 'value')
        .where(`${path} IN (:...values)`, { values })
        .getRawMany<{ value: string }>();
      const known = new Set(rows.map((row) => row.value));
      const missing = rawValues.filter((raw, position) => !known.has(values[position] ?? raw));
      if (missing.length) unrecognized[key] = missing;
    }
    return Object.keys(unrecognized).length ? unrecognized : undefined;
  }

  async findOne(id: string): Promise<AuctionLot> {
    const entity = await this.lots.findOneBy({ id });
    if (!entity) throw new NotFoundException(`Auction lot ${id} was not found`);
    return entity.payload;
  }
}