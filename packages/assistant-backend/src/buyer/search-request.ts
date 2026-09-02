/** Basic text-search request sent from B3 to P2 in Week 2. */
export interface SearchRequest {
  query: string;
  language: 'en' | 'he';
}
