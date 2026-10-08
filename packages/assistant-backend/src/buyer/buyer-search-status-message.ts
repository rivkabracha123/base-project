import type { BuyerCriteria } from './buyer-criteria';
import type { BuyerSearchOutcome } from './buyer-search.orchestrator';
import { UNFILTERED_CRITERIA } from './criteria-to-search-request';

// Status text shown to the buyer, by outcome and chat language. No lots or search internals travel with it.
const STATUS_TEXT: Record<'en' | 'he', Record<BuyerSearchStatusMessage['speaker'], string>> = {
  en: {
    'results-found': 'Results found',
    'no-results': 'No results found',
    'needs-criteria': 'Search needs at least one detail, such as a category, creator or budget',
  },
  he: {
    'results-found': 'נמצאו תוצאות',
    'no-results': 'לא נמצאו תוצאות',
    'needs-criteria': 'לחיפוש נדרש לפחות פרט אחד, כמו קטגוריה, יוצר או תקציב',
  },
};

// Buyer-facing names of criteria that search could not filter by, per chat language.
const UNFILTERED_TEXT: Record<'en' | 'he', { prefix: string } & Record<UnfilteredCriterion, string>> = {
  en: { prefix: 'Not filtered by', periods: 'period', geography: 'location', media: 'medium' },
  he: { prefix: 'לא סוננו לפי', periods: 'תקופה', geography: 'מיקום', media: 'טכניקה' },
};

type UnfilteredCriterion = (typeof UNFILTERED_CRITERIA)[number];

// Minimal search-completion notice for the buyer chat: no lots (the result cards get those) and no searchRequest.
// id/sessionId are not set here; the chat attaches them when the message joins the conversation.
export type BuyerSearchStatusMessage =
  | { speaker: 'results-found'; text: string }
  | { speaker: 'no-results'; text: string }
  | { speaker: 'needs-criteria'; text: string };

export interface BuyerSearchStatusMessageContext {
  language: 'en' | 'he';
  criteria?: Pick<BuyerCriteria, UnfilteredCriterion>;
}

// Builds the "not filtered by ..." note for requested criteria the lots search cannot filter, or '' when none.
function unfilteredNote(context: BuyerSearchStatusMessageContext): string {
  const text = UNFILTERED_TEXT[context.language];
  const requested = UNFILTERED_CRITERIA.filter((field) => (context.criteria?.[field].length ?? 0) > 0);
  return requested.length > 0 ? ` ${text.prefix}: ${requested.map((field) => text[field]).join(', ')}.` : '';
}

// Maps a BuyerSearchOutcome to the plain status message the chat renders as a chat bubble.
export function toBuyerSearchStatusMessage(
  outcome: Pick<BuyerSearchOutcome, 'kind'>,
  context: BuyerSearchStatusMessageContext,
): BuyerSearchStatusMessage {
  if (outcome.kind === 'insufficient-criteria') {
    return { speaker: 'needs-criteria', text: STATUS_TEXT[context.language]['needs-criteria'] };
  }
  const speaker = outcome.kind === 'results' ? 'results-found' : 'no-results';
  const note = unfilteredNote(context);
  return {
    speaker,
    text: note ? `${STATUS_TEXT[context.language][speaker]}.${note}` : STATUS_TEXT[context.language][speaker],
  };
}
