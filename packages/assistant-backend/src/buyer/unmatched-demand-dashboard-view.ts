import type { BuyerSearchRequest } from './buyer-search-request';
import type { DemandSummary } from './explained-results';

/** Dashboard-safe unmatched buyer demand view for the staff dashboard. */
export interface BuyerUnmatchedDemandDashboardView {
  id: string;
  type: 'buyer';
  status: string;
  createdAt: string;
  unmatchedDemand: {
    searchRequest: BuyerSearchRequest;
    reason: 'no_results';
    searchedAt: string;
    demandSummary: DemandSummary;
  };
}

export interface UnmatchedDemandDashboardInput {
  id: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  searchRequest: BuyerSearchRequest;
  demandSummary: DemandSummary;
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
      demandSummary: input.demandSummary,
    },
  };
}
