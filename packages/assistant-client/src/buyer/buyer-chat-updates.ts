import type { AuctionLot } from '@monabid/shared';

/** Why a lot matched, exactly as the search reported it. */
export type BuyerChatMatchReason = { field: string; detail: string };

/** Matches backend `BuyerChatUpdate` — events after POST /buyer/conversation/message. */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | {
      speaker: 'result-group';
      title: string;
      lots: AuctionLot[];
      // Set on the "similar items in other categories" follow-up so the chat shows each lot's category.
      variant?: 'other-categories';
      // Reasons by lot id; present only for lots the search explained.
      matchReasons?: Record<string, BuyerChatMatchReason[]>;
    };
