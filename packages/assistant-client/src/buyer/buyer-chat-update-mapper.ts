import type { BuyerChatUpdate } from './buyer-chat-updates';
import type { BuyerMessage } from './messages';

export function buyerChatUpdateToMessage(update: BuyerChatUpdate, at = new Date().toISOString()): BuyerMessage {
  const id = `msg-${at}-${Math.random().toString(36).slice(2, 9)}`;

  switch (update.speaker) {
    case 'system':
    case 'no-results':
    case 'results-found':
      return { kind: 'assistant', id, at, text: update.text };
    case 'error':
      return { kind: 'error', id, at, code: update.code, text: update.text };
    case 'result-group':
      return { kind: 'result-group', id, at, title: update.title, lots: update.lots };
  }
}
