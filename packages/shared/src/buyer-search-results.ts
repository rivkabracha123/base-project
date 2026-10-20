import type { AuctionLot } from './auction-lot';
import type { BuyerCriteria, Constraint } from './buyer-criteria';
import type { MatchReason, MatchReasonField } from './match-reason';

/** Structured narrowing the buyer search sends to the lots search, mirroring its LotFiltersDto. */
export interface SearchFilters {
  categories?: string[];
  creators?: string[];
  auctionHouseIds?: string[];
  geography?: string[];
  media?: string[];
  periods?: string[];
  dateRange?: { from?: string; to?: string };
  price?: { min?: number; max?: number; currency?: string };
}

/** A lots-search result lot with the match reasons the lots search reported for it. */
export interface ExplainedLot {
  lot: AuctionLot;
  matchReasons: MatchReason[];
}

/** Results grouped for the result cards as upcoming ("current") vs past sales ("historical"), in the lots search's order. */
export interface GroupedResults {
  current: ExplainedLot[];
  historical: ExplainedLot[];
}

/** A lots-search filter the buyer may explicitly agree to drop for one search. */
export type RelaxableField = keyof SearchFilters;

/** The buyer's explicit consent to drop one filter; without it nothing is relaxed. */
export interface ApprovedRelaxation {
  field: RelaxableField;
  approvedAt: string;
}

/** A filter the buyer may choose to drop after a no-result; never applied until the buyer approves it. */
export interface RelaxationOption {
  field: RelaxableField;
  requiresApproval: true;
}

/** Full buyer intent retained for dashboard and later search stages. */
export interface BuyerSearchRequest {
  criteria: BuyerCriteria;
  language: 'en' | 'he';
  hardConstraints: Constraint[];
}

/** Honest no-result account for the staff dashboard: criteria sent, the buyer's hard constraints, and any buyer-approved relaxation. */
export interface DemandSummary {
  appliedCriteria: MatchReasonField[];
  hardConstraints: Constraint[];
  recovery: 'no_relaxation_no_invention' | 'approved_relaxation_no_invention';
  // Present only when the buyer approved dropping these filters for the search that still found nothing.
  relaxedFields?: RelaxableField[];
}

/** Buyer criteria fields a later search can change compared with the original request. */
export type DemandChangedField =
  | 'categories'
  | 'creators'
  | 'periods'
  | 'media'
  | 'keywords'
  | 'geography'
  | 'auctionHouseIds'
  | 'dateRange'
  | 'price';

/** The buyer's latest search after the original no-result: what changed or was approved to drop, and whether it found lots. */
export interface DemandExpansion {
  searchRequest: BuyerSearchRequest;
  // Criteria fields whose values differ from the original request.
  changedFields: DemandChangedField[];
  // Filters the buyer approved dropping for this search, if any.
  relaxedFields?: RelaxableField[];
  searchedAt: string;
  outcome: 'results' | 'no_results';
  // Number of lots found; present only when outcome is 'results'.
  resultCount?: number;
}

/** Dashboard-safe unmatched buyer demand view for the staff dashboard. */
export interface BuyerUnmatchedDemandDashboardView {
  id: string;
  type: 'buyer';
  status: string;
  createdAt: string;
  unmatchedDemand: {
    // The buyer's original request: the first search that found nothing.
    searchRequest: BuyerSearchRequest;
    reason: 'no_results';
    searchedAt: string;
    demandSummary: DemandSummary;
    // The buyer's latest later search, when there is one; staff see the original request alongside it.
    expansion?: DemandExpansion;
  };
}

/** What one buyer search hands the result cards: grouped explained results, a recorded no-result, or a missing-criteria state. */
export type BuyerSearchOutcome =
  | {
      kind: 'results';
      searchRequest: BuyerSearchRequest;
      results: GroupedResults;
      // Filters dropped for this search with the buyer's approval, for the result cards to show as refinements.
      approvedRefinements: RelaxableField[];
      selectedLotId?: string;
    }
  | {
      kind: 'unmatched';
      view: BuyerUnmatchedDemandDashboardView;
      // Filters the buyer may choose to drop next; none is applied without approval.
      relaxationOptions: RelaxationOption[];
      selectedLotId?: string;
    }
  | {
      // Nothing searchable yet (no text and no filters): the lots search is not called and no demand is recorded.
      kind: 'insufficient-criteria';
      searchRequest: BuyerSearchRequest;
      selectedLotId?: string;
    };
