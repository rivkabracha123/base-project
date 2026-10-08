import type { AuctionLot } from './auction-lot';
import type { MatchReason } from './match-reason';

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
