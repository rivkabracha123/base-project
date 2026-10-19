import i18n, { getBrowserLanguage } from '../i18n';
import type { SellerUpdate } from '../chat/chat-types';
import { getSellerMessageIds } from './seller-ids';
import { sellerComparisonModes, sellerComparisonResultSchema } from './seller-comparison-result';
import { houseRankingSchema } from '@monabid/shared';
import { sellerActionResultSchema } from './seller-action-result';
import type { SellerItemDraft } from '@monabid/shared';
import { correctSellerDraftField, getCurrentSellerDraft } from './connect-seller-correction';
import { sellerComparisonFoundStepText, sellerHousesFoundStepText, sellerSearchingStepText } from './seller-steps';
import { selectableHouses } from '../app/SellerJourneyChrome';

interface SellerIntakeResponse {
  ai?: { fallbackMode?: 'guided'; isRelevant?: boolean; generalInformation?: boolean; summary?: string; recommendation?: string; nextAction?: string };
  missingFields?: string[];
  requiredMissingFields?: string[];
  nextQuestion?: { field: string; he: string; en: string } | null;
  conversation?: { assistantSummary?: { he?: string; en?: string } };
  functionCall?: { functionToRun: string | null; object: Record<string, unknown> | null } | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const PENDING_UPLOAD_ITEM_KEY = 'monabid.seller.pendingEvidenceItemId';
const DRAFT_READY_STORAGE_KEY = 'monabid.seller.itemDraftReady';

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

// The model sometimes answers in English during a Hebrew chat; drop any part not in the active language.
function compactVisibleAiText(parts: Array<string | undefined | null>, language: 'he' | 'en'): string {
  const cleaned: string[] = [];
  for (const part of parts) {
    const text = tightenEnglish(String(part ?? '').trim());
    if (!text || !isInLanguage(text, language)) continue;
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (cleaned.some((existing) => {
      const other = existing.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return other.includes(key) || key.includes(other);
    })) continue;
    cleaned.push(text);
  }
  return [...new Set(cleaned)].join('\n');
}

function isInLanguage(text: string, language: 'he' | 'en'): boolean {
  const hebrewLetters = text.match(/[\u05D0-\u05EA]/g)?.length ?? 0;
  const latinLetters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return language === 'he' ? hebrewLetters > latinLetters : latinLetters > hebrewLetters;
}

function tightenEnglish(text: string): string {
  if (!text || /[\u0590-\u05FF]/.test(text) || !/[A-Za-z]/.test(text)) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  return sentences.slice(0, 1).join(' ').replace(/\s+/g, ' ').trim();
}

export function requestedSellerTitle(input: string): string | undefined {
  const match = input.trim().match(
    /(?:^|[\s,;.!])(?:אני\s+)?(?:רוצה\s+)?(?:לשנות|שנה|תשנה|לעדכן|עדכן|תעדכן|לרשום|רשום|תרשום)\s+(?:לי\s+)?(?:את\s+)?(?:ה)?(?:שם|כותרת)(?:\s+(?:של\s+)?(?:ה)?פריט)?(?:\s+(?:לשם|לכותרת|ל|כ|בתור))?\s*[:\-]?\s*(.+)$/i,
  ) ?? input.trim().match(
    /(?:^|[\s,;.!])(?:please\s+)?(?:change|rename|update)\s+(?:the\s+)?(?:item\s+)?(?:name|title)(?:\s+of\s+(?:the\s+)?item)?(?:\s+(?:to|as))?\s+(.+)$/i,
  );
  return match?.[1]?.trim().replace(/^[\s"'״׳]+|[\s"'״׳]+$/g, '').replace(/[.!?]+$/, '').trim() || undefined;
}

export function isSellerEnquiryRequest(input: string): boolean {
  if (/\b(?:don't|do not|cancel)\b|לא\s+(?:רוצה|מעוניי?נ)|בטל/i.test(input)) return false;
  return /פני{1,2}ה|enquir(?:y|ies)/i.test(input)
    && /רוצה|מבקש|מבקשת|ליצור|צור|הכן|הכיני|טיוטת|שלח|כתבי|כתוב|create|prepare|send|write|draft/i.test(input);
}

// בוחרת את השאלה הבאה או סיכום המערכת בשפה הפעילה של האפליקציה.
// Selects the next question or system summary in the application's active language.
export function getSystemText(response: SellerIntakeResponse): string {
  const language = getBrowserLanguage(i18n.language);
  if (response.ai?.isRelevant === false || response.ai?.generalInformation) {
    return compactVisibleAiText([
      response.ai.summary,
      response.ai.generalInformation ? response.ai.recommendation : undefined,
      response.ai.nextAction,
    ], language) || (language === 'he' ? 'אני יכולה לעזור בקנייה או במכירה של פריטים במכירות פומביות.' : 'I can help with buying or selling items at auction.');
  }
  const nextQuestion = response.nextQuestion;
  if (nextQuestion) {
    // The fixed intake question replaces the model's own question so the seller is asked one thing at a time.
    return compactVisibleAiText([
      response.ai?.summary,
      response.ai?.recommendation,
      nextQuestion[language],
    ], language).replaceAll('\n', ' ');
  }

  if (response.requiredMissingFields?.length === 0 || response.missingFields?.length === 0) {
    return language === 'he'
      ? '\u05e4\u05e8\u05d8\u05d9 \u05d4\u05e4\u05e8\u05d9\u05d8 \u05e0\u05e9\u05de\u05e8\u05d5.'
      : 'Your item details are saved.';
  }
  const aiText = compactVisibleAiText([response.ai?.summary, response.ai?.nextAction], language).replaceAll('\n', ' ');
  if (response.ai?.nextAction?.trim() && aiText) return aiText;

  const summary = response.conversation?.assistantSummary?.[language];
  if (summary) return summary;

  return language === 'he' ? 'קיבלתי את פרטי הפריט.' : 'I received the item details.';
}

function getFunctionResultText(functionName: string, result: unknown, language: 'he' | 'en', category?: unknown): string {
  if (functionName === 'calculateSellerValuation' && result && typeof result === 'object') {
    const report = result as { status?: string; valuationRange?: { min: number; max: number; currency: string }; reason?: string };
    if (report.status === 'supported' && report.valuationRange) {
      const { min, max, currency } = report.valuationRange;
      const money = new Intl.NumberFormat(language === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency });
      return `${language === 'he' ? '\u05d4\u05e2\u05e8\u05db\u05ea \u05e9\u05d5\u05d5\u05d9' : 'Estimated value'}: ${money.format(min)} - ${money.format(max)}`;
    }
    if (report.reason !== 'insufficient_comparable_sales') {
      const reasons: Record<string, { he: string; en: string }> = {
        missing_exchange_rate_data: {
          he: '\u05d7\u05e1\u05e8\u05d9\u05dd \u05e0\u05ea\u05d5\u05e0\u05d9 \u05d4\u05de\u05e8\u05ea \u05de\u05d8\u05d1\u05e2 \u05dc\u05d7\u05d9\u05e9\u05d5\u05d1 \u05d4\u05e2\u05e8\u05db\u05ea \u05e9\u05d5\u05d5\u05d9.',
          en: 'Currency conversion data is missing for the valuation.',
        },
        unusable_range_requires_expert_review: {
          he: '\u05d4\u05e2\u05e8\u05db\u05ea \u05d4\u05e9\u05d5\u05d5\u05d9 \u05d3\u05d5\u05e8\u05e9\u05ea \u05d1\u05d3\u05d9\u05e7\u05ea \u05de\u05d5\u05de\u05d7\u05d4.',
          en: 'The valuation requires expert review.',
        },
      };
      return reasons[report.reason ?? '']?.[language] ?? (language === 'he'
        ? '\u05dc\u05d0 \u05d4\u05ea\u05e7\u05d1\u05dc\u05d4 \u05d4\u05e2\u05e8\u05db\u05ea \u05e9\u05d5\u05d5\u05d9 \u05de\u05d1\u05d5\u05e1\u05e1\u05ea.'
        : 'No reliable valuation was returned.');
    }
    return language === 'he'
      ? '\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05d7\u05e9\u05d1 \u05d4\u05e2\u05e8\u05db\u05ea \u05e9\u05d5\u05d5\u05d9 \u05de\u05d1\u05d5\u05e1\u05e1\u05ea \u05de\u05d4\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d4\u05e7\u05d9\u05d9\u05de\u05d9\u05dd. \u05d0\u05d9\u05df \u05de\u05e1\u05e4\u05d9\u05e7 \u05e8\u05d0\u05d9\u05d5\u05ea \u05de\u05db\u05d9\u05e8\u05d4 \u05d0\u05de\u05d9\u05e0\u05d5\u05ea.'
      : 'A reliable valuation cannot be calculated from the available data. There is insufficient credible sale evidence.';
  }
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
    const ranking = record.recommendation && typeof record.recommendation === 'object' && !('house' in record.recommendation)
      ? record.recommendation as Record<string, unknown>
      : record;
    const recommended = ranking.recommendation && typeof ranking.recommendation === 'object'
      ? ranking.recommendation as Record<string, unknown>
      : undefined;
    const house = recommended?.house && typeof recommended.house === 'object'
      ? recommended.house as Record<string, unknown>
      : undefined;
    if (typeof house?.name === 'string') {
      if (typeof category === 'string' && Array.isArray(house.categories) && !house.categories.includes(category)) {
        return language === 'he'
          ? '\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0 \u05d1\u05d9\u05ea \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05e9\u05de\u05ea\u05de\u05d7\u05d4 \u05d1\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4 \u05d4\u05d6\u05d0\u05ea \u05d1\u05e0\u05ea\u05d5\u05e0\u05d9\u05dd \u05d4\u05d6\u05de\u05d9\u05e0\u05d9\u05dd.'
          : 'No auction house specializing in this category was found in the available data.';
      }
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
  onDraftReady?: (draft: SellerItemDraft) => void,
  draftAlreadyShown = false,
): Promise<void> {
  try {
    const input = message.trim();
    if (!input) throw new Error('יש להזין הודעה לפני השליחה.');

    const { profileId, sessionId } = await getSellerMessageIds();
    if (onDraftReady && /item details|more details|פרטי\s+(?:ה)?פריט|פרטים\s+על\s+(?:ה)?פריט/i.test(input)) {
      const draft = await getCurrentSellerDraft();
      if (!draft) throw new Error(i18n.language.startsWith('he') ? 'עדיין אין פריט שמור בשיחה הזו.' : 'There is no saved item in this conversation yet.');
      await sendSellerMessage(i18n.language.startsWith('he') ? 'פרטי הפריט שלך:' : 'Your item details:', onUpdate);
      onDraftReady(draft);
      return;
    }
    const language = getBrowserLanguage(i18n.language);
    const title = requestedSellerTitle(input);
    let body: SellerIntakeResponse;
    if (title) {
      const updatedDraft = await correctSellerDraftField('title', { [language]: title });
      onDraftReady?.(updatedDraft);
      await sendSellerMessage(language === 'he' ? `עדכנתי את שם הפריט ל״${title}״.` : `I updated the item name to “${title}”.`, onUpdate);
      return;
    }
    if (isSellerEnquiryRequest(input)) {
      body = {
        functionCall: {
          functionToRun: 'getSellerEnquiryPreview',
          object: { sessionId, language },
        },
      };
    } else {
      const response = await fetch(`${API_BASE_URL}/seller-intake/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, profileId, sessionId, language }),
      });

      if (!response.ok) {
        throw new Error(`Seller intake request failed (${response.status})`);
      }
      body = await response.json() as SellerIntakeResponse;
    }

    if (body.ai?.isRelevant === false || body.ai?.generalInformation) {
      await sendSellerMessage(getSystemText(body), onUpdate);
      return;
    }
    await publishCompletedDraft(body, onDraftReady, draftAlreadyShown);
    const functionCall = body.functionCall;
    if (functionCall?.functionToRun) {
      const sessionActions = ['calculateSellerValuation', 'searchSellerComparables', 'getSellerComparableHistory',
        'getSellerPriceTrend', 'getSellerItemDetails', 'getSellerCatalogDraft', 'getSellerEnquiryPreview',
        'getSellerProvenanceAdvice', 'getSellerHouseRecommendation'];
      const workflowCall = sessionActions.includes(functionCall.functionToRun)
        ? { functionToRun: functionCall.functionToRun, object: {
            sessionId,
            ...(['getSellerEnquiryPreview', 'getSellerCatalogDraft'].includes(functionCall.functionToRun) ? { language } : {}),
          } } : functionCall;
      const searchingStep = sellerSearchingStepText(functionCall.functionToRun, language);
      if (searchingStep) await sendSellerMessage(searchingStep, onUpdate);
      const workflowResponse = await fetch(`${API_BASE_URL}/seller-workflow/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, structuredAnswer: workflowCall }),
      });
      if (!workflowResponse.ok) {
        const failure = await workflowResponse.json().catch(() => null) as { message?: string | string[] } | null;
        const detail = Array.isArray(failure?.message) ? failure.message.join('; ') : failure?.message;
        throw new Error(detail || `Seller workflow request failed (${workflowResponse.status})`);
      }
      const workflowResult = await workflowResponse.json() as { result?: unknown };
      if (functionCall.functionToRun === 'getSellerEnquiryPreview') {
        const result = workflowResult.result && typeof workflowResult.result === 'object'
          ? workflowResult.result as { draft?: unknown; enquiryText?: unknown; generatedByAi?: unknown }
          : undefined;
        if (typeof result?.enquiryText !== 'string' || !result.enquiryText.trim()) {
          throw new Error('Seller enquiry preview did not include a draft');
        }
        const action = sellerActionResultSchema.safeParse({
          kind: 'enquiry',
          draft: result.draft,
          enquiryText: result.enquiryText.trim(),
          generatedByAi: result.generatedByAi === true,
        });
        if (!action.success) throw new Error('Seller enquiry preview returned an invalid draft');
        await onUpdate({
          speaker: 'system',
          text: language === 'he' ? 'הכנתי טיוטת פנייה שאפשר לערוך:' : 'I prepared an editable enquiry draft:',
          action: action.data,
        });
        return;
      }
      // The catalog text is saved on the item; it is shown only when the seller asks to see or edit it.
      if (functionCall.functionToRun === 'getSellerCatalogDraft') {
        await sendSellerMessage(language === 'he'
          ? 'ניסחתי טיוטת תיאור לקטלוג ושמרתי אותה בפרטי הפריט. אפשר לבקש לראות אותה או לערוך אותה.'
          : 'I drafted a catalog description and saved it in your item details. You can ask to see or edit it.', onUpdate);
        return;
      }
      const kinds: Record<string, 'catalog' | 'valuation'> = {
        calculateSellerValuation: 'valuation',
      };
      if (kinds[functionCall.functionToRun]) {
        const action = sellerActionResultSchema.safeParse({
          ...(workflowResult.result && typeof workflowResult.result === 'object' ? workflowResult.result : {}),
          kind: kinds[functionCall.functionToRun],
        });
        if (action.success) {
          await onUpdate({ speaker: 'system', text: getFunctionResultText(functionCall.functionToRun, workflowResult.result, language), action: action.data });
          return;
        }
        if (functionCall.functionToRun !== 'calculateSellerValuation') throw new Error('Seller action returned an invalid draft');
      }
      if (functionCall.functionToRun === 'getSellerProvenanceAdvice') {
        const result = workflowResult.result as { text?: { he?: string; en?: string } } | undefined;
        if (result?.text?.[language]) { await sendSellerMessage(result.text[language]!, onUpdate); return; }
      }
      if (['rankSellerHouses', 'rankAndStoreSellerHouses', 'rankHousesForLead', 'getSellerHouseRecommendation'].includes(functionCall.functionToRun)) {
        const result = workflowResult.result;
        const direct = houseRankingSchema.safeParse(result);
        const nested = !direct.success && result && typeof result === 'object'
          ? houseRankingSchema.safeParse((result as Record<string, unknown>).recommendation) : direct;
        if (nested.success) {
          const category = functionCall.object?.category ?? (result && typeof result === 'object' ? (result as Record<string, unknown>).category : undefined);
          await sendSellerMessage(sellerHousesFoundStepText(selectableHouses(nested.data)
            .filter((row) => typeof category !== 'string' || row.house.categories.includes(category)).length, language), onUpdate);
          await onUpdate({ speaker: 'system', text: language === 'he' ? 'בתי מכירות מומלצים' : 'Recommended auction houses',
            houseRanking: nested.data,
            ...(typeof category === 'string' ? { houseCategory: category } : {}),
          });
          return;
        }
      }
      const mode = sellerComparisonModes[functionCall.functionToRun];
      if (mode) {
        const comparison = sellerComparisonResultSchema.parse({
          ...(workflowResult.result && typeof workflowResult.result === 'object' ? workflowResult.result : {}), mode,
        });
        const titles = {
          search: { he: '\u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd', en: 'Similar items' },
          history: { he: '\u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05e7\u05d5\u05d3\u05de\u05d5\u05ea \u05e9\u05dc \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd', en: 'Past sales of similar items' },
          trend: { he: '\u05d2\u05e8\u05e3 \u05de\u05d7\u05d9\u05e8\u05d9\u05dd \u05e9\u05dc \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d3\u05d5\u05de\u05d9\u05dd', en: 'Prices of similar items' },
          details: { he: '\u05e4\u05e8\u05d8\u05d9 \u05d4\u05e4\u05e8\u05d9\u05d8 \u05e9\u05dc\u05d9', en: 'My item details' },
        };
        if (comparison.mode !== 'details') {
          await sendSellerMessage(sellerComparisonFoundStepText(comparison.mode, comparison.lots.length, language), onUpdate);
        }
        await onUpdate({ speaker: 'system', text: titles[mode][language], comparison });
        return;
      }
      if (functionCall.functionToRun === 'uploadEvidence' && typeof functionCall.object?.itemId === 'string') {
        sessionStorage.setItem(PENDING_UPLOAD_ITEM_KEY, functionCall.object.itemId);
      }
      await sendSellerMessage(
        getFunctionResultText(functionCall.functionToRun, workflowResult.result, language, functionCall.object?.category),
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

async function publishCompletedDraft(
  response: SellerIntakeResponse,
  onDraftReady?: (draft: SellerItemDraft) => void,
  draftAlreadyShown = false,
): Promise<void> {
  if (!onDraftReady
    || draftAlreadyShown
    || (response.requiredMissingFields ?? response.missingFields)?.length !== 0) return;
  const draft = await getCurrentSellerDraft();
  if (draft) {
    sessionStorage.setItem(DRAFT_READY_STORAGE_KEY, 'true');
    onDraftReady(draft);
  }
}

export function isSellerDraftReady(): boolean {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DRAFT_READY_STORAGE_KEY) === 'true';
}
