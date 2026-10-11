export type BuyerLanguage = 'he' | 'en';

export interface Constraint {
  field: 'price' | 'categories' | 'creators' | 'periods' | 'geography' | 'media' | 'auctionHouseIds';
  operator: 'equal' | 'range' | 'contains';
  value: unknown;
  reason: string;
}

export interface BuyerPriceRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface BuyerDateRange {
  from?: string;
  to?: string;
}

export interface BuyerCriteria {
  categories: string[];
  creators: string[];
  periods: string[];
  media: string[];
  keywords: string[];
  geography: string[];
  auctionHouseIds: string[];
  dateRange?: BuyerDateRange;
  price?: BuyerPriceRange;
  language: BuyerLanguage;
  hardConstraints: Constraint[];
}
