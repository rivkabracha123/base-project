/** Structured narrowing alongside `query`, mirroring P2's LotFiltersDto exactly - an unlisted key is rejected by P2, never silently dropped. */
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
