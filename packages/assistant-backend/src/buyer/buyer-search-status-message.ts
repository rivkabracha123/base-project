import type { BuyerSearchOutcome } from './buyer-search.orchestrator';

// Status text shown to the buyer, by outcome and chat language. No lots or search internals travel with it.
const STATUS_TEXT: Record<'en' | 'he', Record<BuyerSearchStatusMessage['speaker'], string>> = {
  en: { 'results-found': 'Results found', 'no-results': 'No results found' },
  he: { 'results-found': 'נמצאו תוצאות', 'no-results': 'לא נמצאו תוצאות' },
};

// Minimal search-completion notice for B1's chat: no lots (B4 sends those) and no searchRequest.
// id/sessionId are not B3's to set — B1 attaches them when the message joins the conversation.
export type BuyerSearchStatusMessage =
  | { speaker: 'results-found'; text: string }
  | { speaker: 'no-results'; text: string };

export interface BuyerSearchStatusMessageContext {
  language: 'en' | 'he';
}

// Maps a BuyerSearchOutcome to the plain status message B1 renders as a chat bubble.
export function toBuyerSearchStatusMessage(
  outcome: Pick<BuyerSearchOutcome, 'kind'>,
  context: BuyerSearchStatusMessageContext,
): BuyerSearchStatusMessage {
  const speaker = outcome.kind === 'results' ? 'results-found' : 'no-results';
  return {
    speaker,
    text: STATUS_TEXT[context.language][speaker],
  };
}
