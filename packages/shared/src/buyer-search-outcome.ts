import type { AuctionLot } from './auction-lot';

export type MatchReason = {
  field:
    | 'categories'
    | 'creators'
    | 'periods'
    | 'media'
    | 'keywords'
    | 'geography'
    | 'auctionHouseIds'
    | 'price';
  detail: string;
};

export type ExplainedLot = {
  lot: AuctionLot;
  matchReasons: MatchReason[];
};

export type GroupedResults = {
  current: ExplainedLot[];
  historical: ExplainedLot[];
};

export type ExplainedResultCard = ExplainedLot;
