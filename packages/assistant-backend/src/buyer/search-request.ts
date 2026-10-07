/** Structured narrowing mirroring LotFiltersDto; the lots search resolves creator names to canonical tokens. */
export interface SearchFilters {
  categories?: string[];
  creators?: string[];
  auctionHouseIds?: string[];
  dateRange?: { from?: string; to?: string };
  price?: { min?: number; max?: number; currency?: string };
}

/** Request sent to POST /api/lots/search, mirroring LotSearchDto. */
export interface SearchRequest {
  query: string;
  language: 'en' | 'he';
  filters?: SearchFilters;
}

/** Mirrors the lots search's PaginatedResult<AuctionLot> pending its publication in @monabid/shared. */
export interface PaginatedSearchResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
