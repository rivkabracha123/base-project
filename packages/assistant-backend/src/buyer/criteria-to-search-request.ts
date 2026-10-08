import type { BuyerCriteria } from './buyer-criteria';
import type { SearchFilters, SearchRequest } from './search-request';

function hasBudget(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

/** Buyer criteria P2 has no filter for; they are not sent and the buyer is told so. */
export const UNFILTERED_CRITERIA = ['periods', 'geography', 'media'] as const;

// Only P2-supported facets: UNFILTERED_CRITERIA stay out.
function buildFilters(criteria: BuyerCriteria): SearchFilters | undefined {
  const filters: SearchFilters = {};
  if (criteria.categories.length > 0) filters.categories = criteria.categories;
  if (criteria.creators.length > 0) filters.creators = criteria.creators;
  if (criteria.auctionHouseIds.length > 0) filters.auctionHouseIds = criteria.auctionHouseIds;
  if (criteria.dateRange?.from || criteria.dateRange?.to) filters.dateRange = criteria.dateRange;
  if (hasBudget(criteria)) filters.price = criteria.price;

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** Converts buyer criteria into the typed P2 search request: free text plus structured filters. */
export function criteriaToSearchRequest(
  criteria: BuyerCriteria,
  language: SearchRequest['language'],
): SearchRequest {
  const query = criteria.keywords
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');
  const filters = buildFilters(criteria);

  return {
    query,
    language,
    ...(filters ? { filters } : {}),
  };
}
