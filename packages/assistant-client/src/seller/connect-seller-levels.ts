import i18n, { getBrowserLanguage } from '../i18n';
import type { SellerUpdate } from '../chat/chat-types';

interface SellerIntakeResponse {
  missingFields?: string[];
  nextQuestion?: { field: string; he: string; en: string } | null;
  conversation?: { assistantSummary?: { he?: string; en?: string } };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const PROFILE_STORAGE_KEY = 'monabid.seller.profileId';
const SESSION_STORAGE_KEY = 'monabid.seller.sessionId';

// מציגה הודעת מערכת למוכר דרך callback של מסך הצ'אט וממתינה לעדכון המסך.
// Displays a system message through the chat screen callback and waits for the UI update.
export async function sendSellerMessage(
  text: string,
  onUpdate: (update: SellerUpdate) => void | Promise<void>,
): Promise<void> {
  await onUpdate({ speaker: 'system', text });
}

// מחזירה מזהה קיים מהאחסון או יוצרת ושומרת מזהה חדש.
// Returns an existing stored identifier or creates and stores a new one.
function getOrCreateId(storage: Storage, key: string): string {
  const existingId = storage.getItem(key);
  if (existingId) return existingId;

  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

// מנהלת מזהי פרופיל ושיחה פנימיים הנדרשים ל־API, בלי להוסיף אותם לעדכוני הממשק.
// Manages internal profile and session IDs required by the API without adding them to UI updates.
function getSellerMessageIds(): { profileId: string; sessionId: string } {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
    throw new Error('Seller chat requires browser storage');
  }

  return {
    profileId: getOrCreateId(localStorage, PROFILE_STORAGE_KEY),
    sessionId: getOrCreateId(sessionStorage, SESSION_STORAGE_KEY),
  };
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

    const { profileId, sessionId } = getSellerMessageIds();
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
