import type { AuctionLot } from '@monabid/shared';

export type PriceTrendPoint = {
  lotId: string;
  saleDate: string;
  title: string;
  price: { amount: number; currency: string };
};

/** Matches backend `BuyerChatUpdate` — events after POST /buyer/conversation/message. */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | { speaker: 'result-group'; title: string; lots: AuctionLot[] }
  | { speaker: 'price-trend'; title: string; lots: AuctionLot[]; points: PriceTrendPoint[] };
