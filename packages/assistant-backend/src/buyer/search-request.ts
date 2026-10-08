import type { SearchFilters } from '@monabid/shared';

export type { SearchFilters };

/** Request sent to POST /api/lots/search, mirroring LotSearchDto. */
export interface SearchRequest {
  query: string;
  language: 'en' | 'he';
  filters?: SearchFilters;
}
