import type { AuctionLot } from '@monabid/shared';

/** Payload for connectLevels — B1 adds id, sessionId, and at when rendering. */
export type BuyerUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'results-found'; text: string }
  | { speaker: 'result-group'; lots: AuctionLot[] };
