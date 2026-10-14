import type { AuctionLot, HouseRanking } from '@monabid/shared';
import type { PriceTrendPoint } from './buyer-results-presentation.port';

/** Why a lot matched, exactly as the search reported it: the matched part of the request and the value sent. */
export type BuyerChatMatchReason = { field: string; detail: string };

/** Events B2 pushes to Tamar after one buyer message (open → P4 → criteria → search). */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'house-ranking'; ranking: HouseRanking; category: string }
  | { speaker: 'sale-history'; title: string; lots: AuctionLot[] }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | {
      speaker: 'result-group';
      title: string;
      lots: AuctionLot[];
      evidenceLotIds?: string[];
      // Set on the "similar items in other categories" follow-up so the chat shows each lot's category.
      variant?: 'other-categories';
      // Reasons by lot id; present only for lots the search explained.
      matchReasons?: Record<string, BuyerChatMatchReason[]>;
    }
  | { speaker: 'price-trend'; title: string; lots: AuctionLot[]; points: PriceTrendPoint[] };
