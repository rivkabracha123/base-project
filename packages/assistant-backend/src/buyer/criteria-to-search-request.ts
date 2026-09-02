import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';

/** Converts buyer criteria into the Week 2 text-search boundary request. */
export function criteriaToSearchRequest(
  criteria: BuyerCriteria,
  language: SearchRequest['language'],
): SearchRequest {
  const query = [criteria.creator, ...(criteria.keywords ?? [])]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');

  return {
    query,
    language,
  };
}
