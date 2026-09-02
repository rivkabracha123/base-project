import type { BuyerSearchRequest } from './buyer-search-request';

/** Dashboard-safe unmatched buyer demand view for P5. */
export interface BuyerUnmatchedDemandDashboardView {
  id: string;
  type: 'buyer';
  status: string;
  createdAt: string;
  unmatchedDemand: {
    searchRequest: BuyerSearchRequest;
    reason: 'no_results';
    searchedAt: string;
  };
}

export interface UnmatchedDemandDashboardInput {
  id: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  searchRequest: BuyerSearchRequest;
}

/** Wraps a no-result search as a dashboard view without private data. */
export function createUnmatchedDemandDashboardView(input: UnmatchedDemandDashboardInput): BuyerUnmatchedDemandDashboardView {
  return {
    id: input.id,
    type: 'buyer',
    status: input.status,
    createdAt: input.createdAt,
    unmatchedDemand: {
      searchRequest: input.searchRequest,
      reason: 'no_results',
      searchedAt: input.searchedAt,
    },
  };
}
