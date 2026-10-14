import type { BuyerCriteria } from './buyer-criteria';
import type { SearchFilters, SearchRequest } from './search-request';

function hasBudget(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

/** Buyer criteria sent only for the values the lots search can read; any other value is not sent and the buyer is told so. */
export const CONVERTED_CRITERIA = ['periods', 'geography', 'media'] as const;
export type ConvertedCriterion = (typeof CONVERTED_CRITERIA)[number];

const ORDINAL_CENTURY = /^(\d{1,2})(?:st|nd|rd|th)(?: century)?$/i;
const YEAR = /^\d{4}$/;
const ENGLISH_TERM = /^[a-z0-9][a-z0-9\s-]*$/i;

function keywordSynonyms(keyword: string): string[] {
  const value = keyword.trim();
  if (!value) return [];

  const synonyms: string[] = [];
  if (/\bmanuscripts?\b|\u05db\u05ea\u05d1(?:\u05d9)?\s+\u05d9\u05d3/i.test(value)) synonyms.push('manuscript');
  if (/\bantique\b|\u05e2\u05ea\u05d9\u05e7/i.test(value)) synonyms.push('antique');
  if (/\bhebrew\b|\u05e2\u05d1\u05e8\u05d9/i.test(value)) synonyms.push('Hebrew');
  if (/\brare\b|\u05e0\u05d3\u05d9\u05e8/i.test(value)) synonyms.push('rare');

  if (synonyms.length > 0) return synonyms;
  return [value];
}

function searchKeywords(criteria: BuyerCriteria): string[] {
  const values = criteria.keywords.flatMap(keywordSynonyms);
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

// English ordinal suffix for a century number (1st, 2nd, 3rd, 11th, 21st).
function ordinal(century: number): string {
  const lastTwo = century % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${century}th`;
  return `${century}${{ 1: 'st', 2: 'nd', 3: 'rd' }[century % 10] ?? 'th'}`;
}

// Period as the lots search reads it ("19th century"): "19th" and a year like "1890" convert, anything else is not sent.
export function toSearchPeriod(period: string): string | undefined {
  const value = period.trim();
  const century = ORDINAL_CENTURY.exec(value)?.[1];
  if (century) return `${ordinal(Number(century))} century`;
  if (YEAR.test(value)) return `${ordinal(Math.floor((Number(value) - 1) / 100) + 1)} century`;
  return undefined;
}

// Geography and medium are read in English only; a Hebrew value is not sent.
function toSearchTerm(value: string): string | undefined {
  const term = value.trim();
  return ENGLISH_TERM.test(term) ? term : undefined;
}

// Converts one value of a converted criterion to what the lots search reads, or undefined when it cannot.
function toSearchValue(field: ConvertedCriterion, value: string): string | undefined {
  return field === 'periods' ? toSearchPeriod(value) : toSearchTerm(value);
}

// The values of one converted criterion that the lots search can read, deduplicated in order.
export function searchableValues(criteria: Pick<BuyerCriteria, ConvertedCriterion>, field: ConvertedCriterion): string[] {
  const values = criteria[field]
    .map((value) => toSearchValue(field, value))
    .filter((value): value is string => value !== undefined);
  return [...new Set(values)];
}

/** Converted criteria with at least one value that was not sent, for the buyer's "not filtered by" note. */
export function unfilteredCriteria(criteria: Pick<BuyerCriteria, ConvertedCriterion>): ConvertedCriterion[] {
  return CONVERTED_CRITERIA.filter((field) =>
    criteria[field].some((value) => toSearchValue(field, value) === undefined),
  );
}

// Only values the lots search can read are sent; see CONVERTED_CRITERIA.
function buildFilters(criteria: BuyerCriteria): SearchFilters | undefined {
  const filters: SearchFilters = {};
  if (criteria.categories.length > 0) filters.categories = criteria.categories;
  if (criteria.creators.length > 0) filters.creators = criteria.creators;
  if (criteria.auctionHouseIds.length > 0) filters.auctionHouseIds = criteria.auctionHouseIds;
  for (const field of CONVERTED_CRITERIA) {
    const values = searchableValues(criteria, field);
    if (values.length > 0) filters[field] = values;
  }
  if (criteria.dateRange?.from || criteria.dateRange?.to) filters.dateRange = criteria.dateRange;
  if (hasBudget(criteria)) filters.price = criteria.price;

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** Converts buyer criteria into the typed lots-search request: free text plus structured filters. */
export function criteriaToSearchRequest(
  criteria: BuyerCriteria,
  language: SearchRequest['language'],
): SearchRequest {
  const query = searchKeywords(criteria)
    .join(' ');
  const filters = buildFilters(criteria);

  return {
    query,
    language,
    ...(filters ? { filters } : {}),
  };
}
