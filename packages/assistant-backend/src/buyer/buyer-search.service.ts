import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';
import { criteriaToSearchRequest } from './criteria-to-search-request';

/** Application service for creating buyer search requests. */
export class BuyerSearchService {
  /** Builds a typed P2 request with caller-supplied language. */
  createSearchRequest(
    criteria: BuyerCriteria,
    language: SearchRequest['language'],
  ): SearchRequest {
    return criteriaToSearchRequest(criteria, language);
  }
}
