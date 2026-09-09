import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';

export function criteriaToSearchRequest(
  criteria: BuyerCriteria,
  language: SearchRequest['language'],
): SearchRequest {
  const query = [...criteria.creators, ...criteria.keywords]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');

  return {
    query,
    language,
  };
}
