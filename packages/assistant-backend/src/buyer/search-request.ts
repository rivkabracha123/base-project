export interface SearchRequest {
  query?: string;
  category?: string;
  creator?: string;
  period?: string;
  format?: string;
  maxPrice?: number;
  geography?: string;
  keywords?: string[];
  auctionHouse?: string;
  language: 'en' | 'he';
}