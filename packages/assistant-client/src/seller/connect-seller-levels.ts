import type { ChatUpdate, OnChatUpdate } from '../chat/chat-types';
import type { SellerMessage } from './messages';

// מה שנשלח ל-callback של המוכר: הודעה בלי id ו-sessionId — המסך משלים אותם.
export type SellerUpdate = ChatUpdate<SellerMessage>;

// ה-callback של מסך המוכר: כל גורם בשרשרת קורא לו כדי להציג הודעה למוכר.
export type OnSellerUpdate = OnChatUpdate<SellerMessage>;

// זמני: מדמה את חיבור הרמות של המוכר עד שהאמיתי יהיה מוכן ויחליף את הקובץ הזה.
// חשוב: ה-Promise מסתיים רק כשכל התהליך נגמר.
export async function connectSellerLevels(_message: string, onUpdate: OnSellerUpdate): Promise<void> {
  onUpdate({ speaker: 'system', text: 'בודק את הפרטים...' });
}
