import i18n, { getBrowserLanguage } from '../i18n';
import type { SellerUpdate } from '../chat/chat-types';
import { getSellerMessageIds } from './seller-ids';

interface SellerIntakeResponse {
  missingFields?: string[];
  nextQuestion?: { field: string; he: string; en: string } | null;
  conversation?: { assistantSummary?: { he?: string; en?: string } };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

// מציגה הודעת מערכת למוכר דרך callback של מסך הצ'אט וממתינה לעדכון המסך.
// Displays a system message through the chat screen callback and waits for the UI update.
export async function sendSellerMessage(
  text: string,
  onUpdate: (update: SellerUpdate) => void | Promise<void>,
): Promise<void> {
  await onUpdate({ speaker: 'system', text });
}

// בוחרת את השאלה הבאה או סיכום המערכת בשפה הפעילה של האפליקציה.
// Selects the next question or system summary in the application's active language.
function getSystemText(response: SellerIntakeResponse): string {
  const language = getBrowserLanguage(i18n.language);
  const nextQuestion = response.nextQuestion;
  if (nextQuestion) return nextQuestion[language];

  const summary = response.conversation?.assistantSummary?.[language];
  if (summary) return summary;

  return language === 'he' ? 'קיבלתי את פרטי הפריט.' : 'I received the item details.';
}

// שולחת הודעת מוכר ל־seller-intake ומחזירה את תשובת המערכת דרך callback של תמר.
// Sends a seller message to seller-intake and returns the system response through Tamar's callback.
export async function connectSellerLevels(
  message: string,
  onUpdate: (update: SellerUpdate) => void | Promise<void>,
): Promise<void> {
  try {
    const input = message.trim();
    if (!input) throw new Error('יש להזין הודעה לפני השליחה.');

    const { profileId, sessionId } = await getSellerMessageIds();
    const response = await fetch(`${API_BASE_URL}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, profileId, sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Seller intake request failed (${response.status})`);
    }

    const body = await response.json() as SellerIntakeResponse;
    await sendSellerMessage(getSystemText(body), onUpdate);
  } catch (error) {
    const update: SellerUpdate = {
      speaker: 'error',
      code: error instanceof TypeError ? 'SELLER_CONNECTION_FAILED' : 'SELLER_INTAKE_FAILED',
      text: error instanceof Error ? error.message : 'Seller intake failed',
    };
    await onUpdate(update);
    throw error;
  }
}
