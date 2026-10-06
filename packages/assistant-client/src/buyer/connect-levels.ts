import type { ChatUpdate, OnChatUpdate } from '../chat/chat-types';
import type { BuyerMessage } from './messages';

// מה שנשלח ל-callback של הקונה: הודעה בלי id ו-sessionId — המסך משלים אותם.
export type BuyerUpdate = ChatUpdate<BuyerMessage>;

// ה-callback של מסך הקונה: כל גורם בשרשרת קורא לו כדי להציג הודעה לקונה.
export type OnUpdate = OnChatUpdate<BuyerMessage>;

// זמני: מדמה את חיבור הרמות עד שהאמיתי יהיה מוכן ויחליף את הקובץ הזה.
// חשוב: ה-Promise מסתיים רק כשכל התהליך (כולל החיפוש) נגמר.
export async function connectLevels(_message: string, onUpdate: OnUpdate): Promise<void> {
  onUpdate({ speaker: 'system', text: 'בודק תוצאות...' });
}
