import i18n, { getBrowserLanguage } from '../i18n';
import { getCurrentProfile } from '../app/api';
import type { SellerUpdate } from '../chat/chat-types';

interface SellerIntakeResponse {
  ai?: { fallbackMode?: 'guided' };
  missingFields?: string[];
  nextQuestion?: { field: string; he: string; en: string } | null;
  conversation?: { assistantSummary?: { he?: string; en?: string } };
  functionCall?: { functionToRun: string | null; object: Record<string, unknown> | null } | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const SESSION_STORAGE_KEY = 'monabid.seller.sessionId';
const PENDING_UPLOAD_ITEM_KEY = 'monabid.seller.pendingEvidenceItemId';

export function getPendingSellerEvidenceItemId(): string | undefined {
  return typeof sessionStorage === 'undefined'
    ? undefined
    : sessionStorage.getItem(PENDING_UPLOAD_ITEM_KEY) ?? undefined;
}

export function clearPendingSellerEvidenceItemId(itemId: string): void {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PENDING_UPLOAD_ITEM_KEY) === itemId) {
    sessionStorage.removeItem(PENDING_UPLOAD_ITEM_KEY);
  }
}

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
async function getSellerMessageIds(): Promise<{ profileId: string; sessionId: string }> {
  if (typeof sessionStorage === 'undefined') {
    throw new Error('Seller chat requires browser storage');
  }

  const profile = await getCurrentProfile();
  return {
    profileId: profile.id,
    sessionId: getOrCreateId(sessionStorage, SESSION_STORAGE_KEY),
  };
}

// בוחרת את השאלה הבאה או סיכום המערכת בשפה הפעילה של האפליקציה.
// Selects the next question or system summary in the application's active language.
function getSystemText(response: SellerIntakeResponse): string {
  const language = getBrowserLanguage(i18n.language);
  const nextQuestion = response.nextQuestion;
  const fallbackNotice = response.ai?.fallbackMode === 'guided'
    ? language === 'he'
      ? 'ה־AI אינו זמין כרגע, אז נמשיך באיסוף פרטים מונחה. '
      : 'AI is temporarily unavailable, so we will continue with guided questions. '
    : '';
  if (nextQuestion) return `${fallbackNotice}${nextQuestion[language]}`;

  const summary = response.conversation?.assistantSummary?.[language];
  if (summary) return `${fallbackNotice}${summary}`;

  return `${fallbackNotice}${language === 'he' ? 'קיבלתי את פרטי הפריט.' : 'I received the item details.'}`;
}

function getFunctionResultText(functionName: string, result: unknown, language: 'he' | 'en'): string {
  const messages: Record<string, { he: string; en: string }> = {
    createSellerLeadDraft: { he: 'טיוטת הפנייה נשמרה.', en: 'The enquiry draft was saved.' },
    createSellerLead: { he: 'טיוטת הפנייה נשמרה.', en: 'The enquiry draft was saved.' },
    rankSellerHouses: { he: 'המלצת בתי המכירות מוכנה.', en: 'The auction-house ranking is ready.' },
    rankAndStoreSellerHouses: { he: 'הדירוג נשמר בפנייה.', en: 'The ranking was saved to the enquiry.' },
    rankHousesForLead: { he: 'הדירוג נשמר בפנייה.', en: 'The ranking was saved to the enquiry.' },
    chooseSellerHouse: { he: 'בחירת בית המכירות נשמרה.', en: 'The auction-house choice was saved.' },
    saveSellerHouseChoice: { he: 'בחירת בית המכירות נשמרה.', en: 'The auction-house choice was saved.' },
    submitFinalSellerLead: { he: 'הפנייה הפנימית הוגשה.', en: 'The internal enquiry was submitted.' },
    listSellerLeads: { he: 'רשימת הפניות נטענה.', en: 'Your enquiries were loaded.' },
    getSellerLead: { he: 'פרטי הפנייה נטענו.', en: 'The enquiry details were loaded.' },
    listEvidence: { he: 'רשימת התמונות נטענה.', en: 'Your uploaded images were loaded.' },
    uploadEvidence: { he: 'אפשר לצרף את התמונה באמצעות כפתור צירוף התמונה.', en: 'Attach the image using the photo attachment button.' },
    getEvidenceFile: { he: 'קישור התמונה מוכן.', en: 'The image link is ready.' },
    reorderEvidence: { he: 'סדר התמונות עודכן.', en: 'The image order was updated.' },
    deleteEvidence: { he: 'התמונה הוסרה.', en: 'The image was removed.' },
  };
  const fallback = messages[functionName]?.[language] ?? (language === 'he' ? 'הפעולה הושלמה.' : 'The action completed.');
  const record = result && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown>
    : undefined;

  if (functionName === 'listSellerLeads' && Array.isArray(result)) {
    const titles = result.flatMap((lead) => {
      if (!lead || typeof lead !== 'object') return [];
      const item = (lead as Record<string, unknown>).item;
      const title = item && typeof item === 'object' ? (item as Record<string, unknown>).title : undefined;
      return typeof title === 'string' && title.trim() ? [title.trim()] : [];
    }).slice(0, 3);
    if (result.length === 0) return language === 'he' ? 'אין עדיין פניות שמורות.' : 'You have no saved enquiries yet.';
    const count = language === 'he' ? `${result.length} פניות שמורות` : `${result.length} saved enquiries`;
    return titles.length ? `${count}: ${titles.join(', ')}` : `${count}.`;
  }

  if (functionName === 'getSellerLead' && record) {
    const item = record.item && typeof record.item === 'object' ? record.item as Record<string, unknown> : undefined;
    if (typeof item?.title === 'string') return language === 'he' ? `פרטי הפנייה עבור ${item.title} נטענו.` : `Enquiry details loaded for ${item.title}.`;
  }

  if (['rankSellerHouses', 'rankAndStoreSellerHouses', 'rankHousesForLead', 'submitFinalSellerLead'].includes(functionName) && record) {
    const ranking = record.recommendation && typeof record.recommendation === 'object'
      ? record.recommendation as Record<string, unknown>
      : record;
    const recommended = ranking.recommendation && typeof ranking.recommendation === 'object'
      ? ranking.recommendation as Record<string, unknown>
      : undefined;
    const house = recommended?.house && typeof recommended.house === 'object'
      ? recommended.house as Record<string, unknown>
      : undefined;
    if (typeof house?.name === 'string') {
      return language === 'he' ? `בית המכירות המומלץ: ${house.name}.` : `Recommended auction house: ${house.name}.`;
    }
  }

  if (functionName === 'listEvidence' && Array.isArray(result)) {
    return language === 'he' ? `${result.length} תמונות שמורות.` : `${result.length} saved images.`;
  }

  return fallback;
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
    const language = getBrowserLanguage(i18n.language);
    const functionCall = body.functionCall;
    if (functionCall?.functionToRun) {
      const workflowResponse = await fetch(`${API_BASE_URL}/seller-workflow/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, structuredAnswer: functionCall }),
      });
      if (!workflowResponse.ok) {
        throw new Error(`Seller workflow request failed (${workflowResponse.status})`);
      }
      const workflowResult = await workflowResponse.json() as { result?: unknown };
      if (functionCall.functionToRun === 'uploadEvidence' && typeof functionCall.object?.itemId === 'string') {
        sessionStorage.setItem(PENDING_UPLOAD_ITEM_KEY, functionCall.object.itemId);
      }
      await sendSellerMessage(
        `${getSystemText(body)} ${getFunctionResultText(functionCall.functionToRun, workflowResult.result, language)}`.trim(),
        onUpdate,
      );
      return;
    }
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
