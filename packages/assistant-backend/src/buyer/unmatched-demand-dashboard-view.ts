import type { BuyerSearchRequest, BuyerUnmatchedDemandDashboardView, DemandSummary } from '@monabid/shared';

export type { BuyerUnmatchedDemandDashboardView };

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
