export type BuyerChatSpeaker = 'system' | 'buyer';

/** System message the chat UI shows after extract or a clarification turn. */
export type BuyerChatSystemMessage = {
  id: string;
  sessionId: string;
  speaker: 'system';
  text: string;
  date: string;
};

/** Buyer answer or explicit skip sent from the chat UI back to the criteria session. */
export type BuyerChatTurnInput =
  | {
      id: string;
      sessionId: string;
      speaker: 'buyer';
      skipped: false;
      text: string;
      date: string;
    }
  | {
      id: string;
      sessionId: string;
      speaker: 'buyer';
      skipped: true;
      date: string;
    };

/** One line in session history — same ids as chat UI messages. */
export type BuyerChatHistoryEntry =
  | { id: string; speaker: 'system'; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: false; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: true; date: string };

export type BuyerChatHistoryInput =
  | { id: string; speaker: 'system'; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: false; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: true; date: string };

export function buildChatSystemMessage(
  sessionId: string,
  message: { id: string; speaker: 'system'; text: string; date: string },
): BuyerChatSystemMessage {
  return {
    id: message.id,
    sessionId,
    speaker: 'system',
    text: message.text,
    date: message.date,
  };
}
