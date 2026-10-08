import type { BuyerChatUpdate } from './buyer-chat-update';
import type { BuyerFlowUpdate } from './buyer-flow.types';

/** Maps contract flow updates to Tamar's current BuyerChatUpdate stream. */
export function buyerFlowUpdatesToChatUpdates(
  update: BuyerFlowUpdate,
  language: 'he' | 'en',
): BuyerChatUpdate[] {
  switch (update.type) {
    case 'loading':
      return [
        {
          speaker: 'system',
          text: language === 'he' ? 'מחפשים פריטים…' : 'Searching for lots…',
        },
      ];
    case 'progress':
      return [{ speaker: 'results-found', text: update.text }];
    case 'result_cards':
      return update.groups
        .filter((group) => group.items.length > 0)
        .map((group) => ({
          speaker: 'result-group' as const,
          title: group.title,
          lots: group.items.map((item) => item.lot),
        }));
    case 'unmatched':
      return [{ speaker: 'no-results', text: update.text }];
    case 'error':
      return [{ speaker: 'error', code: update.code, text: update.text }];
    default:
      return [];
  }
}
