import type { SellerUpdate } from '../chat/chat-types';
import { correctSellerDraftField } from './connect-seller-correction';

// After the AI drafts a catalog description, the chat shows only the text and asks whether to save
// or update it. Nothing is written to the item until the seller says to save it.

type Language = 'he' | 'en';
type OnUpdate = (update: SellerUpdate) => void | Promise<void>;
type Review = { sessionId: string; language: Language; text: string; awaitingEdit: boolean };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

let review: Review | null = null;

const copy = {
  question: { he: 'לשמור את התיאור בפרטי הפריט, או לעדכן אותו?', en: 'Should I save this description to your item details, or update it?' },
  whatToChange: {
    he: 'מה לשנות בתיאור? אפשר לכתוב מה לשנות, או לכתוב את התיאור המלא כפי שהוא צריך להופיע.',
    en: 'What should I change? You can describe the change, or write the full description as it should appear.',
  },
  saved: { he: 'שמרתי את התיאור בפרטי הפריט.', en: 'I saved the description to your item details.' },
  declined: { he: 'בסדר, התיאור לא נשמר.', en: 'Okay, the description was not saved.' },
  notRevised: {
    he: 'לא הצלחתי לעדכן את התיאור כרגע. אפשר לכתוב את התיאור המלא כפי שהוא צריך להופיע.',
    en: 'I could not update the description right now. You can write the full description as it should appear.',
  },
  empty: { he: 'לא הצלחתי לנסח תיאור כרגע.', en: 'I could not draft a description right now.' },
  notUnderstood: {
    he: 'לא הבנתי. לשמור את התיאור בפרטי הפריט, או לעדכן אותו?',
    en: 'Sorry, I did not understand. Should I save this description to your item details, or update it?',
  },
} as const;

// \b does not work next to Hebrew letters, so words are delimited by spaces and punctuation.
function words(alternatives: string): RegExp {
  return new RegExp(`(?:^|[\\s,.!?])(?:${alternatives})(?=$|[\\s,.!?])`, 'i');
}

// "לא טוב" or "I don't like it" asks for a change, not to drop the description.
const DISLIKE = /^(?:לא\s+(?:טוב|אהבתי|מתאים|מוצלח|מספיק)|(?:not\s+good|i\s+don'?t\s+like))/i;
const DECLINE =/^(?:לא|אל\s|בטל|ביטול|דלג|no\b|cancel\b|skip\b|don't\b|do not\b)/i;
const SAVE = words('כן|שמור|שמרי|לשמור|תשמור|תשמרי|נשמור|שמירה|תשאיר|תשאירי|להשאיר|השאר|השאירי|נשאיר|שיישאר|אשר|אשרי|מאשר|מאשרת|אישור|מעולה|בסדר|יופי|נהדר|מושלם|טוב|אהבתי|מתאים|סגור|אוקיי|אוקי|save|keep|yes|ok|okay|sure|good|fine|looks good|great|perfect');
const GENERIC_UPDATE = 'עדכן|לעדכן|תעדכן|תעדכני|עדכני|שנה|לשנות|תשנה|תשני|שני|ערוך|לערוך|תערוך|תערכי|ערכי|update|change|edit|revise';
const UPDATE = words(`${GENERIC_UPDATE}|תקן|לתקן|תתקן|תתקני|הוסף|להוסיף|תוסיף|תוסיפי|הוסיפי|הסר|להסיר|תסיר|תסירי|תוריד|תורידי|קצר|לקצר|תקצר|תקצרי|קצרי|הארך|להאריך|תאריך|תאריכי|rewrite|fix|add|remove|shorter|longer|shorten`);

// "עדכן אותו" or "update it" asks to update without saying how.
function isBareUpdate(input: string): boolean {
  const rest = input
    .replace(new RegExp(GENERIC_UPDATE, 'gi'), '')
    .replace(/אותו|אותה|את התיאור|התיאור|בבקשה|אני רוצה|רוצה|\b(?:it|the description|please|i want to|i'd like to)\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return rest.length < 3;
}

export function resetSellerCatalogReview(): void {
  review = null;
}

async function requestDescription(profileId: string, object: Record<string, unknown>, language: Language) {
  const response = await fetch(`${API_BASE_URL}/seller-workflow/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, structuredAnswer: { functionToRun: 'getSellerCatalogDraft', object: { ...object, language } } }),
  });
  if (!response.ok) throw new Error(`Seller workflow request failed (${response.status})`);
  const body = await response.json() as { result?: { he?: unknown; en?: unknown; revised?: unknown } };
  const text = body.result?.[language];
  return { text: typeof text === 'string' ? text.trim() : '', revised: body.result?.revised };
}

async function showForReview(next: Review, onUpdate: OnUpdate): Promise<void> {
  review = next;
  await onUpdate({ speaker: 'system', text: next.text });
  await onUpdate({ speaker: 'system', text: copy.question[next.language] });
}

/** Shows a freshly drafted description (from the workflow result) and asks whether to save or update it. */
export async function startSellerCatalogReview(
  sessionId: string,
  language: Language,
  result: unknown,
  onUpdate: OnUpdate,
): Promise<void> {
  const text = result && typeof result === 'object' ? (result as Record<string, unknown>)[language] : undefined;
  if (typeof text !== 'string' || !text.trim()) {
    review = null;
    await onUpdate({ speaker: 'system', text: copy.empty[language] });
    return;
  }
  await showForReview({ sessionId, language, text: text.trim(), awaitingEdit: false }, onUpdate);
}

/**
 * Handles the seller's answer while a description waits for review.
 * Returns false when the message is not about the description, so the normal flow handles it.
 */
export async function continueSellerCatalogReview(
  input: string,
  ids: { profileId: string; sessionId: string },
  onUpdate: OnUpdate,
): Promise<boolean> {
  if (!review || review.sessionId !== ids.sessionId) return false;
  const current = review;
  const { language } = current;
  const text = input.trim();

  if (DISLIKE.test(text) && !UPDATE.test(text)) {
    review = { ...current, awaitingEdit: true };
    await onUpdate({ speaker: 'system', text: copy.whatToChange[language] });
    return true;
  }
  if (DECLINE.test(text) && !UPDATE.test(text)) {
    review = null;
    await onUpdate({ speaker: 'system', text: copy.declined[language] });
    return true;
  }
  if (SAVE.test(text) && !UPDATE.test(text)) {
    await correctSellerDraftField('description', { [language]: current.text });
    review = null;
    await onUpdate({ speaker: 'system', text: copy.saved[language] });
    return true;
  }
  if (UPDATE.test(text) && isBareUpdate(text)) {
    review = { ...current, awaitingEdit: true };
    await onUpdate({ speaker: 'system', text: copy.whatToChange[language] });
    return true;
  }
  if (!current.awaitingEdit && !UPDATE.test(text) && !text.includes('?') && text.split(/\s+/).length <= 3) {
    // A short answer that is neither save nor update is probably about the description: ask again instead of dropping it.
    await onUpdate({ speaker: 'system', text: copy.notUnderstood[language] });
    return true;
  }
  if (!current.awaitingEdit && !UPDATE.test(text)) {
    // Something else: leave the description unsaved and continue the conversation.
    review = null;
    return false;
  }

  const revised = await requestDescription(ids.profileId, { sessionId: ids.sessionId, previous: current.text, revision: text }, language);
  if (!revised.text || revised.revised === false) {
    review = { ...current, awaitingEdit: true };
    await onUpdate({ speaker: 'system', text: copy.notRevised[language] });
    return true;
  }
  await showForReview({ ...current, text: revised.text, awaitingEdit: false }, onUpdate);
  return true;
}
