// Omit that keeps working on each member of a union (a plain Omit would merge the members into one shape).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// מה שנשלח ל-callback של המסך: הודעה בלי id ו-sessionId — המסך משלים אותם.
export type ChatUpdate<TMessage> = DistributiveOmit<TMessage, 'id' | 'sessionId'>;

// ה-callback של המסך: כל גורם בשרשרת קורא לו כדי להציג הודעה לקונה או למוכר.
export type OnChatUpdate<TMessage> = (update: ChatUpdate<TMessage>) => void;

// הצורה המינימלית שיש לכל הודעת שיחה (קונה או מוכר).
export interface BaseChatMessage {
  id: string;
  sessionId: string;
  speaker: string;
}
export type SellerUpdate =
  | { speaker: 'system'; text: string }
  | { speaker: 'error'; code: string; text: string };
