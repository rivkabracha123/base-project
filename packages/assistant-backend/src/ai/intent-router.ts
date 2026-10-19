import type { CompletionState } from './completion-state';

export type BuyerIntent =
  | 'get_lot_details'
  | 'price_trend'
  | 'same_item_sale_history'
  | 'search_similar_lots'
  | 'search_auction_lots'
  | 'buyer_house_ranking'
  | 'unknown';

type RouterContext = {
  selectedLot?: Record<string, unknown>;
  lots?: unknown[];
  language?: 'he' | 'en';
  category?: string;
  geography?: string;
  completionState?: CompletionState;
  sessionId?: string;
};

export type IntentRoute = {
  intent: BuyerIntent;
  functionName: 'getLotById' | 'getComparableSaleHistory' | 'getPriceTrend' | 'rankSellerHouses' | 'searchLots' | null;
  readyForFunction: boolean;
  missingFields: string[];
  arguments: Record<string, unknown>;
};

const similarItemsPattern = /פריטים דומים|פריטים נוספים|פריטים כאלה|similar items|similar lots|alternatives/i;
const saleHistoryPattern = /היסטוריה|\bhistory\b|מכירות\s+(?:קודמות|עבר|בעבר)|היסטור(?:יית|ית) (?:המכירות|מכירות|מכירה|מחירים)|(?:המחירים|מחירים|מחירי)(?=\s|[?!.,]|$)|previous sales|past sales|sale history|price history|sold records/i;
const lotDetailsPattern = /פרטי הפריט|פרטים על הפריט|פרטים נוספים|איך אפשר להעריך|item details|more details|details of the item|evaluate (?:it|the item)/i;
const searchPattern = /מחפש|מחפשת|לחפש|חפש|חפשי|מצא|תמצא|search|find|עד \$?\d|עד [\d,]+/i;

export function routeBuyerIntent(prompt: string, context: RouterContext = {}): IntentRoute {
  // Route on the buyer's latest words only; earlier assistant text ("7 previous sales found") must not pick the action.
  const normalizedPrompt = (prompt.split('Latest buyer message:\n').at(-1) ?? prompt).trim();
  const language = context.language ?? 'he';
  if (/גרף|(?:איך|כיצד).*(?:מחירים|המחירים).*(?:השתנו|משתנים)|\b(?:graphs?|charts?|price trends?)\b|\u05de\u05d2\u05de\u05ea?\s+\u05de\u05d7\u05d9\u05e8\u05d9\u05dd|\u05de\u05d2\u05de\u05d5\u05ea\s+\u05de\u05d7\u05d9\u05e8\u05d9\u05dd/i.test(normalizedPrompt)) {
    const missingFields = context.lots?.length ? [] : ['lots'];
    return { intent: 'price_trend', functionName: 'getPriceTrend', readyForFunction: missingFields.length === 0, missingFields, arguments: {} };
  }

  if (/(?:בית|בתי)\s+מכירות|auction\s+houses?/i.test(normalizedPrompt) &&
      /מתמח|התמחות|מתאי(?:ם|מ)|מומל|speciali[sz]|expert|recommend|best|suitable/i.test(normalizedPrompt)) {
    const category = context.category?.trim();
    const missingFields = category && !['כללי', 'general', 'unknown'].includes(category.toLowerCase()) ? [] : ['category'];
    return {
      intent: 'buyer_house_ranking',
      functionName: 'rankSellerHouses',
      readyForFunction: missingFields.length === 0,
      missingFields,
      arguments: { ...(missingFields.length === 0 ? { category } : {}), ...(context.geography ? { geography: context.geography } : {}), language },
    };
  }

  if (saleHistoryPattern.test(normalizedPrompt)) {
    const category = context.category?.trim();
    if (!context.selectedLot?.id && category && !['unknown', 'general'].includes(category)) {
      return {
        intent: 'search_similar_lots', functionName: 'searchLots', readyForFunction: true,
        missingFields: [], arguments: { status: 'sold', category, language },
      };
    }
    const missingFields: string[] = [];
    // B2 loads itemKey and the sale pool through its lots resolver.
    if (typeof context.selectedLot?.id !== 'string' || !context.selectedLot.id.trim()) {
      missingFields.push('selectedLot.id');
    }

    return {
      intent: 'same_item_sale_history',
      functionName: 'getComparableSaleHistory',
      readyForFunction: missingFields.length === 0,
      missingFields,
      arguments: {
        ...(context.selectedLot ? { selectedLot: context.selectedLot } : {}),
        ...(context.lots ? { lots: context.lots } : {}),
      },
    };
  }

  if (similarItemsPattern.test(normalizedPrompt) || /מכירות\s+דומות|similar sales/i.test(normalizedPrompt)) {
    const hasSelectedLot = typeof context.selectedLot?.id === 'string' && !!context.selectedLot.id.trim();
    const category = context.category?.trim();
    const ready = hasSelectedLot || !!category && !['unknown', 'general'].includes(category);
    return {
      intent: 'search_similar_lots',
      functionName: ready ? 'searchLots' : null,
      readyForFunction: ready,
      missingFields: ready ? [] : ['selectedLot.id or category'],
      arguments: {
        ...(context.selectedLot ? { selectedLot: context.selectedLot } : {}),
        ...(!hasSelectedLot && category ? { category } : {}),
        ...(/מכירות\s+דומות|נמכר|בעבר|similar sales|\bsold\b|\bpast\b/i.test(normalizedPrompt) ? { status: 'sold' } : {}),
        language,
      },
    };
  }

  if (lotDetailsPattern.test(normalizedPrompt)) {
    const id = context.selectedLot?.id;
    const missingFields = typeof id === 'string' && id.trim() ? [] : ['selectedLot.id'];
    return {
      intent: 'get_lot_details',
      functionName: 'getLotById',
      readyForFunction: missingFields.length === 0,
      missingFields,
      arguments: typeof id === 'string' && id.trim() ? { id, language } : { language },
    };
  }

  if (searchPattern.test(normalizedPrompt)) {
    const state = context.completionState;
    const missingFields = state
      ? [...new Set([
          ...state.blockingFields,
          ...Object.entries(state.fields)
            .filter(([, field]) => field.required && ['missing', 'uncertain'].includes(field.status))
            .map(([name]) => name),
        ])]
      : ['completionState'];
    if (state && !state.readyForFunctions && missingFields.length === 0) missingFields.push('completionState');
    return {
      intent: 'search_auction_lots',
      functionName: 'searchLots',
      readyForFunction: missingFields.length === 0,
      missingFields,
      arguments: { language, ...(context.sessionId ? { sessionId: context.sessionId } : {}) },
    };
  }

  return {
    intent: 'unknown',
    functionName: null,
    readyForFunction: false,
    missingFields: ['intent'],
    arguments: {},
  };
}
