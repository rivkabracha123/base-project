export type BuyerIntent =
  | 'get_lot_details'
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
};

export type IntentRoute = {
  intent: BuyerIntent;
  functionName: 'getLotById' | 'getComparableSaleHistory' | 'rankSellerHouses' | null;
  readyForFunction: boolean;
  missingFields: string[];
  arguments: Record<string, unknown>;
};

const similarItemsPattern = /פריטים דומים|פריטים נוספים|פריטים כאלה|similar items|similar lots|alternatives/i;
const saleHistoryPattern = /היסטור(?:יית|ית) (?:המכירות|מכירה|מחירים)|המחירים\b|מחירי(?:ם)?\b|previous sales|sale history|price history|sold records/i;
const lotDetailsPattern = /פרטי הפריט|פרטים על הפריט|איך אפשר להעריך|item details|details of the item|evaluate (?:it|the item)/i;
const searchPattern = /מחפש|מחפשת|לחפש|search|find|עד \$?\d|עד [\d,]+/i;

export function routeBuyerIntent(prompt: string, context: RouterContext = {}): IntentRoute {
  const normalizedPrompt = prompt.trim();
  const language = context.language ?? 'he';

  if (/(?:בית|בתי)\s+מכירות|auction\s+houses?/i.test(normalizedPrompt) &&
      /מתמח|התמחות|מתאים|מומל|speciali[sz]|expert|recommend|best|suitable/i.test(normalizedPrompt)) {
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
    const missingFields: string[] = [];
    if (!context.selectedLot) missingFields.push('selectedLot');
    else if (typeof context.selectedLot.itemKey !== 'string' || !context.selectedLot.itemKey.trim()) missingFields.push('selectedLot.itemKey');
    if (!Array.isArray(context.lots)) missingFields.push('lots');

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

  if (similarItemsPattern.test(normalizedPrompt)) {
    return {
      intent: 'search_similar_lots',
      functionName: null,
      readyForFunction: false,
      missingFields: ['similarLotsFunction'],
      arguments: context.selectedLot ? { selectedLot: context.selectedLot, language } : { language },
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
    return {
      intent: 'search_auction_lots',
      functionName: null,
      readyForFunction: false,
      missingFields: ['searchAuctionLotsFunction'],
      arguments: { language },
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
