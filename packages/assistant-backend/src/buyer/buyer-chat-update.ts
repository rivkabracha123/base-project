import type { AuctionLot, HouseRanking } from '@monabid/shared';
import type { PriceTrendPoint } from './buyer-results-presentation.port';

/** Events B2 pushes to Tamar after one buyer message (open → P4 → criteria → search). */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'house-ranking'; ranking: HouseRanking; category: string }
  | { speaker: 'sale-history'; title: string; lots: AuctionLot[] }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | { speaker: 'result-group'; title: string; lots: AuctionLot[]; evidenceLotIds?: string[] }
  | { speaker: 'price-trend'; title: string; lots: AuctionLot[]; points: PriceTrendPoint[] };
