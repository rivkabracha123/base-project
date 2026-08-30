import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';
import { criteriaToSearchRequest } from './criteria-to-search-request';

export class BuyerSearchService {
  createSearchRequest(criteria: BuyerCriteria): SearchRequest {
    return criteriaToSearchRequest(criteria);
  }
}