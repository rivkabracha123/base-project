export type BuyerChatSpeaker = 'system' | 'buyer';

/** B2 → Tamar: system question shown in chat after extract or turn. */
export type BuyerCriteriaB1Response = {
  id: string;
  sessionId: string;
  speaker: 'system';
  text: string;
  date: string;
};

/** Tamar → B2: buyer answer or explicit skip. */
export type BuyerCriteriaTurnRequest =
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

/** One line in session history — same ids as Tamar chat messages. */
export type BuyerCriteriaHistoryEntry =
  | { id: string; speaker: 'system'; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: false; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: true; date: string };

export type BuyerCriteriaHistoryInput =
  | { id: string; speaker: 'system'; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: false; text: string; date: string }
  | { id: string; speaker: 'buyer'; skipped: true; date: string };

export function toBuyerCriteriaB1Response(
  sessionId: string,
  message: { id: string; speaker: 'system'; text: string; date: string },
): BuyerCriteriaB1Response {
  return {
    id: message.id,
    sessionId,
    speaker: 'system',
    text: message.text,
    date: message.date,
  };
}
