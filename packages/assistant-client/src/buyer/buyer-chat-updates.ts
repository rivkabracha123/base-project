import type { AuctionLot } from '@monabid/shared';

/** Matches backend `BuyerChatUpdate` — events after POST /buyer/conversation/message. */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | { speaker: 'result-group'; title: string; lots: AuctionLot[] };
