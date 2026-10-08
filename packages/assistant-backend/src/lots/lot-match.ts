import type { AuctionLot, MatchReason, PaginatedResult } from '@monabid/shared';

export interface LotMatch {
  lot: AuctionLot;
  matchReasons: MatchReason[];
}

// The list filters whose values are tokens that can be looked up in the data.
export type ListFacet = 'categories' | 'creators' | 'auctionHouseIds' | 'geography' | 'media' | 'statuses' | 'periods';

// Sent filter values, as sent, that match nothing in the data at all. Present
// only on an empty result, and only for the facets that have such values.
export type UnrecognizedFilters = Partial<Record<ListFacet, string[]>>;

export type LotSearchResult = PaginatedResult<LotMatch> & { unrecognizedFilters?: UnrecognizedFilters };
