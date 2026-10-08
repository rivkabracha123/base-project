import type { AuctionLot } from '@monabid/shared';
import type { MatchReason } from './explained-results';

/** B2 → B1 screen updates (contract alias; Tamar maps to chat UI). */
export type BuyerFlowUpdate =
  | { type: 'loading' }
  | { type: 'progress'; text: string }
  | { type: 'result_cards'; groups: ResultCardGroup[] }
  | { type: 'unmatched'; text: string }
  | { type: 'error'; code: string; text: string };

export type BuyerFlowOnUpdate = (update: BuyerFlowUpdate) => void;

export type ResultCardItem = {
  lot: AuctionLot;
  matchReasons: MatchReason[];
};

/** B4 presentation groups for chat / ResultsPage. */
export type ResultCardGroup = {
  title: string;
  items: ResultCardItem[];
};
