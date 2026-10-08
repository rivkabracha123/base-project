import type { BuyerChatUpdate } from './buyer-chat-updates';
import type { BuyerMessage } from './messages';

// Placeholder session id until the client holds the real session id returned by the server.
const LOCAL_SESSION_ID = 'local-session';

// Turns an update from the B2 flow into a chat message in the shape the screen displays:
// speaker (who is talking), id and sessionId (shared by every message), plus the fields of that kind.
export function buyerChatUpdateToMessage(update: BuyerChatUpdate, sessionId = LOCAL_SESSION_ID): BuyerMessage {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  switch (update.speaker) {
    case 'system':
    case 'no-results':
    case 'results-found':
      return { speaker: update.speaker, id, sessionId, text: update.text };
    case 'error':
      return { speaker: 'error', id, sessionId, code: update.code, text: update.text };
    case 'result-group':
      return { speaker: 'result-group', id, sessionId, title: update.title, lots: update.lots };
  }
}
