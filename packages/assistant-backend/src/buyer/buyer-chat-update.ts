import type { AuctionLot } from '@monabid/shared';

/** Events B2 pushes to Tamar after one buyer message (open → P4 → criteria → search). */
export type BuyerChatUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | { speaker: 'result-group'; title: string; lots: AuctionLot[] };
