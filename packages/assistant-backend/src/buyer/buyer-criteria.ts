export interface BuyerCriteria {
  category?: string;
  creator?: string;
  period?: string;
  format?: string;
  budgetMax?: number;
  geography?: string;
  keywords?: string[];
  auctionHouse?: string;
  language: 'en' | 'he';
}