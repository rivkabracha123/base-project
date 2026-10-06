/** Structured narrowing mirroring P2's LotFiltersDto; `creators` is omitted from output since no committed lot populates it yet (P2 ANDs filters, so it would zero out matches). */
export interface SearchFilters {
  categories?: string[];
  creators?: string[];
  auctionHouseIds?: string[];
  dateRange?: { from?: string; to?: string };
  price?: { min?: number; max?: number; currency?: string };
}

/** Request sent from B3 to P2's POST /api/lots/search, mirroring P2's LotSearchDto. */
export interface SearchRequest {
  query: string;
  language: 'en' | 'he';
  filters?: SearchFilters;
}

/** Mirrors P2's PaginatedResult<AuctionLot> pending its publication in @monabid/shared. */
export interface PaginatedSearchResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
