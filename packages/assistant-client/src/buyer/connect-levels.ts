import type { ChatUpdate, OnChatUpdate } from '../chat/chat-types';
import { submitBuyerChatMessage } from './buyer-chat-flow';
import type { BuyerMessage } from './messages';

// מה שנשלח ל-callback של הקונה: הודעה בלי id ו-sessionId — המסך משלים אותם.
export type BuyerUpdate = ChatUpdate<BuyerMessage>;

// ה-callback של מסך הקונה: כל גורם בשרשרת קורא לו כדי להציג הודעה לקונה.
export type OnUpdate = OnChatUpdate<BuyerMessage>;

// החיבור האמיתי של הקונה: שולח את ההודעה לשרת (שפונה ל-Shilat, מריץ קריטריונים וחיפוש) וכל עדכון שחוזר
// מועבר ל-callback של המסך. ה-Promise מסתיים רק כשכל העדכונים הוצגו; אם השרת נכשל הוא נכשל, והמסך מציג שגיאה.
export async function connectLevels(message: string, onUpdate: OnUpdate, language: 'he' | 'en'): Promise<void> {
  await submitBuyerChatMessage(message, onUpdate, { language });
}
