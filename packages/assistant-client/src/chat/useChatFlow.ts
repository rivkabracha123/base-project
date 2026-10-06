import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ZodType } from 'zod';
import type { BaseChatMessage, ChatUpdate, OnChatUpdate } from './chat-types';

// Placeholder session id for locally-created messages until the client is wired to the real P3 anonymous session.
export const LOCAL_SESSION_ID = 'local-session';

// ───────────────────────────────────────────────────────────────────────────────────────────────
// useChatFlow — הלוגיקה המשותפת של מסך שיחה (קונה או מוכר). הוא לא מצייר כלום.
//
// הזרימה כשהמשתמש שולח הודעה:
//   handleSend(text)
//     1. מציג את הודעת המשתמש                (דרך onUpdate)
//     2. נועל את השדה                         (isBusy = true)
//     3. connect(text, onUpdate)              ← כאן "מוסרים" את ה-callback לחיבור;
//                                               בכל פעם שהחיבור קורא ל-onUpdate(...) — הודעה מוצגת
//     4. אם נכשל: מציג הודעת שגיאה
//     5. פותח את השדה                         (isBusy = false, תמיד)
//
// מה שונה בין קונה למוכר מוזרק מבחוץ (ראו UseChatFlowOptions); כל השאר זהה.
// ───────────────────────────────────────────────────────────────────────────────────────────────

interface UseChatFlowOptions<TMessage extends BaseChatMessage> {
  // הסכמה שכל הודעה נבדקת מולה (של הקונה או של המוכר).
  schema: ZodType<TMessage>;
  // איך טוענים את השיחה הקיימת: מפתח המטמון והקריאה לשרת.
  conversation: {
    queryKey: readonly unknown[];
    fetch: (signal: AbortSignal) => Promise<TMessage[]>;
  };
  // איך נראית ההודעה של המשתמש עצמו (קונה או מוכר).
  userMessage: (text: string) => ChatUpdate<TMessage>;
  // החיבור לשכבה שמנהלת את התהליך. ה-Promise שלו מסתיים כשכל התהליך נגמר.
  connect: (message: string, onUpdate: OnChatUpdate<TMessage>) => Promise<void>;
  // הטקסט שמוצג למשתמש כשמשהו משתבש.
  errorText: string;
}

export function useChatFlow<TMessage extends BaseChatMessage>({
  schema,
  conversation,
  userMessage,
  connect,
  errorText,
}: UseChatFlowOptions<TMessage>) {
  // השיחה הקיימת, כפי שנטענה מהשרת.
  const query = useQuery({
    queryKey: conversation.queryKey,
    queryFn: ({ signal }) => conversation.fetch(signal),
  });

  // ההודעות שנוספו מקומית (המשתמש + עדכונים מה-callback); מתחיל ריק וגדל.
  const [liveMessages, setLiveMessages] = useState<TMessage[]>([]);
  // true כל עוד החיבור עובד (חושב או מחפש); בזמן הזה אי אפשר לשלוח.
  const [isBusy, setIsBusy] = useState(false);

  // מוסיף הודעה לסוף השיחה ונותן לה id ייחודי. כאן ההודעה נכנסת לרשימה ו-React מציירת אותה.
  function addToScreen(message: TMessage) {
    setLiveMessages((prev) => [...prev, { ...message, id: `local-${prev.length + 1}` }]);
  }

  // מציג הודעת שגיאה ידידותית (בצורה המשותפת של errorMessageSchema, שקיימת גם בסכמת הקונה וגם במוכר).
  // זה המקום היחיד שבו יש cast: הקוד הכללי לא יכול לדעת שסוג ההודעה כולל שגיאה.
  function showError(code: string) {
    addToScreen({
      speaker: 'error',
      id: 'pending',
      sessionId: LOCAL_SESSION_ID,
      code,
      text: errorText,
    } as unknown as TMessage);
  }

  // ה-callback היחיד להצגה: כל גורם בשרשרת קורא לו כדי להציג הודעה.
  // הודעה תקינה מוצגת; הודעה פגומה לא מוצגת כמו שהיא — מוצגת במקומה שגיאה, והפרטים נרשמים ל-console למפתחות.
  const onUpdate: OnChatUpdate<TMessage> = (update) => {
    const parsed = schema.safeParse({ ...update, id: 'pending', sessionId: LOCAL_SESSION_ID });
    if (parsed.success) {
      addToScreen(parsed.data);
      return;
    }
    console.warn('Invalid chat update ignored', update, parsed.error);
    showError('invalid-update');
  };

  // מה שקורה כשהמשתמש שולח הודעה (הזרימה המלאה מתוארת בראש הקובץ).
  async function handleSend(text: string) {
    // הגנה נוספת מעבר לנעילת השדה: בזמן שהעבודה רצה לא שולחים הודעה נוספת.
    if (isBusy) return;
    onUpdate(userMessage(text));
    setIsBusy(true);
    try {
      await connect(text, onUpdate);
    } catch {
      // רשת ביטחון: כל שגיאה שלא טופלה בדרך מוצגת כהודעת שגיאה.
      showError('send-failed');
    } finally {
      // תמיד פותחים את השדה, גם אחרי שגיאה, כדי שהמשתמש לא יישאר תקוע.
      setIsBusy(false);
    }
  }

  return {
    // כל השיחה לציור: מה שנטען מהשרת, ואחריו ההודעות שנוספו מקומית.
    messages: [...(query.data ?? []), ...liveMessages],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => query.refetch(),
    isBusy,
    handleSend,
  };
}
