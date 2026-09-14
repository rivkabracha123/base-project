import type { BuyerCriteria } from './buyer-criteria';
import type { SearchFilters, SearchRequest } from './search-request';

function hasBudget(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

// Only facets P2's LotFiltersDto declares AND that P1's committed data actually
// populates. `creator` is a real column on P2's side but is not yet populated on
// any committed lot; since P2 ANDs every filter together, sending it alongside
// categories/price would zero out otherwise-matching results. Creators stay
// text-only via `query` until P1 confirms the field is populated. periods/media/
// geography have no structured filter facet at all yet, so they stay text-only too.
function buildFilters(criteria: BuyerCriteria): SearchFilters | undefined {
  const filters: SearchFilters = {};
  if (criteria.categories.length > 0) filters.categories = criteria.categories;
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
  const query = [...criteria.creators, ...criteria.keywords]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');
  const filters = buildFilters(criteria);

  return {
    query,
    language,
    ...(filters ? { filters } : {}),
  };
}
