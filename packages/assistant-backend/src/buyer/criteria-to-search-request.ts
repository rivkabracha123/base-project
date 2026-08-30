import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';

export function criteriaToSearchRequest(
  criteria: BuyerCriteria,
): SearchRequest {
  return {
    category: criteria.category,
    creator: criteria.creator,
    period: criteria.period,
    format: criteria.format,
    maxPrice: criteria.budgetMax,
    geography: criteria.geography,
    keywords: criteria.keywords,
    auctionHouse: criteria.auctionHouse,
    language: criteria.language,
  };
}