
export type BuyerLanguage = 'he' | 'en';

export interface Constraint {
  field: 'price' | 'categories' | 'creators' | 'periods' | 'geography' | 'media' | 'auctionHouseIds';
  operator: 'equal' | 'range' | 'contains';
  value: unknown;
  reason: string;
}

export interface BuyerPriceRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface BuyerDateRange {
  from?: string;
  to?: string;
}

export interface BuyerCriteria {
  categories: string[];
  creators: string[];
  periods: string[];
  media: string[];
  keywords: string[];
  geography: string[];
  auctionHouseIds: string[];
  dateRange?: BuyerDateRange;
  price?: BuyerPriceRange;
  language: BuyerLanguage;
  hardConstraints: Constraint[];
}

export interface BuyerCriteriaConversation {
  skipped: SearchFact[];
  missing: SearchFact[];
  nextQuestion: string;
  notes: string[];
}

export interface BuyerCriteriaResponse {
  criteria: BuyerCriteria;
  conversation: BuyerCriteriaConversation;
}

export const SEARCH_FACTS = ['budget', 'category', 'creator', 'period', 'location'] as const;
export type SearchFact = (typeof SEARCH_FACTS)[number];

export const OPTIONAL_SEARCH_FACTS: readonly SearchFact[] = ['budget', 'creator', 'period', 'location'];

export function emptyBuyerCriteria(language: BuyerLanguage = 'en'): BuyerCriteria {
  return {
    categories: [],
    creators: [],
    periods: [],
    media: [],
    keywords: [],
    geography: [],
    auctionHouseIds: [],
    language,
    hardConstraints: [],
  };
}

export type BuyerCriteriaTurnRequest = {
  criteria: BuyerCriteria;
  conversation: BuyerCriteriaConversation;
  action: 'answer' | 'skip';
  message?: string;
};

export type P4FixtureResponse = {
  provider: 'fixture' | 'real';
  mode: 'fixture' | 'real';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
};

const appendUnique = (values: string[], ...additions: Array<string | null | undefined>): string[] =>
  [...new Set([...values, ...additions.filter((value): value is string => Boolean(value?.trim()))])];

const toNumber = (value: string): number | undefined => {
  const normalized = value.replace(/[$,\s]/g, '').replace(/k/i, '000');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractPrice = (text: string): BuyerPriceRange | undefined => {
  const matches = [...text.matchAll(/\$?\d[\d,]*(?:k)?/gi)]
    .map((match) => match[0])
    .filter((value) => {
      const lower = value.toLowerCase();
      return !/\d+(st|nd|rd|th)\b/i.test(value) && !/^\d{4}$/.test(value.replace(/[$,]/g, '')) &&
        (lower.includes('$') || lower.includes('k') || value.length > 3);
    });
  const values = matches.map(toNumber).filter((value): value is number => value !== undefined);

  return values.length > 0
    ? { min: Math.min(...values), max: Math.max(...values), currency: 'USD' }
    : undefined;
};

const parseCategory = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (lower.includes('painting') || lower.includes('ציור') || lower.includes('תמונה')) return 'painting';
  if (lower.includes('sculpture') || lower.includes('פסל')) return 'sculpture';
  return null;
};

const parsePeriod = (text: string): string | null => {
  const match = text.match(/(19th|20th|(?:19|20)\d{2})/i);
  if (!match) return null;
  const value = match[0].toLowerCase();
  return value.includes('19th') ? '19th' : value.includes('20th') ? '20th' : value;
};

const KEYWORD_HINTS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\bblue\b|כחול/i, keyword: 'blue' },
  { pattern: /\bred\b|אדום/i, keyword: 'red' },
  { pattern: /\bgreen\b|ירוק/i, keyword: 'green' },
  { pattern: /\brare\b|נדיר/i, keyword: 'rare' },
  { pattern: /\bhebrew\b|עברי/i, keyword: 'Hebrew' },
  { pattern: /\bmanuscript\b|כתב יד/i, keyword: 'manuscript' },
];

export function extractKeywords(text: string): string[] {
  const keywords = KEYWORD_HINTS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ keyword }) => keyword);
  return [...new Set(keywords)];
}

export function hasKeywords(criteria: BuyerCriteria): boolean {
  return criteria.keywords.some((keyword) => keyword.trim().length > 0);
}

export function hasSearchIntent(criteria: BuyerCriteria): boolean {
  return criteria.categories.some((category) => category.trim().length > 0) || hasKeywords(criteria);
}

const HEBREW_LETTER = /[\u0590-\u05FF]/;

export function detectBuyerLanguage(text: string): BuyerLanguage {
  return HEBREW_LETTER.test(text) ? 'he' : 'en';
}

const FOCUSED_QUESTIONS: Record<SearchFact, Record<BuyerLanguage, string>> = {
  budget: {
    he: 'יש טווח תקציב שכדאי להישאר בתוכו?',
    en: 'Is there a budget range I should stay within?',
  },
  category: {
    he: 'איזה סוג פריט מחפשים — למשל ציור או פסל?',
    en: 'What kind of item are you looking for — for example a painting or a sculpture?',
  },
  creator: {
    he: 'יש אמן או יוצר מסוים?',
    en: 'Is there a specific artist or maker?',
  },
  period: {
    he: 'יש תקופה או שנה שכדאי להתמקד בה?',
    en: 'Is there a period or year I should focus on?',
  },
  location: {
    he: 'יש מקום או מקור שחשוב?',
    en: 'Is there a place or origin that matters?',
  },
};

const READY_TO_CONTINUE: Record<BuyerLanguage, string> = {
  he: 'יש את העובדות העיקריות לחיפוש. אפשר להמשיך?',
  en: 'I have the main search facts. Should I continue?',
};

function hasPrice(criteria: BuyerCriteria): boolean {
  return criteria.price?.min != null || criteria.price?.max != null;
}

function isSkipped(conversation: BuyerCriteriaConversation, field: SearchFact): boolean {
  return conversation.skipped.includes(field);
}

export const buildMissingFields = (
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
): SearchFact[] => {
  const missing: SearchFact[] = [];
  if (!hasPrice(criteria) && !isSkipped(conversation, 'budget')) missing.push('budget');
  if (!hasSearchIntent(criteria) && !isSkipped(conversation, 'category')) missing.push('category');
  if (criteria.creators.length === 0 && !isSkipped(conversation, 'creator')) missing.push('creator');
  if (criteria.periods.length === 0 && !isSkipped(conversation, 'period')) missing.push('period');
  if (criteria.geography.length === 0 && !isSkipped(conversation, 'location')) missing.push('location');
  return missing;
};

export function currentMissingField(
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
): SearchFact | undefined {
  const missing = buildMissingFields(criteria, conversation);
  return SEARCH_FACTS.find((fact) => missing.includes(fact));
}

export function nextFocusedQuestion(missing: SearchFact[], language: BuyerLanguage): string {
  const field = SEARCH_FACTS.find((fact) => missing.includes(fact));
  return field ? FOCUSED_QUESTIONS[field][language] : READY_TO_CONTINUE[language];
}

function withConversation(
  criteria: BuyerCriteria,
  conversation: Partial<BuyerCriteriaConversation> = {},
): BuyerCriteriaResponse {
  const language = criteria.language ?? 'en';
  const baseConversation: BuyerCriteriaConversation = {
    skipped: conversation.skipped ?? [],
    notes: conversation.notes ?? [],
    missing: [],
    nextQuestion: '',
  };
  const missing = buildMissingFields(criteria, baseConversation);

  return {
    criteria: { ...criteria, language },
    conversation: {
      ...baseConversation,
      missing,
      nextQuestion: nextFocusedQuestion(missing, language),
    },
  };
}

export function extractBuyerCriteriaFromFixture(response: P4FixtureResponse): BuyerCriteriaResponse {
  const text = `${response.content} ${response.summary} ${response.recommendation} ${response.nextAction}`;
  const category = parseCategory(text);
  const keywords = extractKeywords(text);
  const period = parsePeriod(text);

  return withConversation({
    ...emptyBuyerCriteria(detectBuyerLanguage(response.content)),
    categories: category ? [category] : [],
    periods: period ? [period] : [],
    price: extractPrice(text),
    keywords,
  }, {
    notes: [response.summary],
  });
}

export function mergeBuyerCriteria(
  existing: BuyerCriteria,
  update: Partial<BuyerCriteria>,
): BuyerCriteria {
  return {
    ...existing,
    ...update,
    categories: update.categories ?? existing.categories,
    creators: update.creators ?? existing.creators,
    periods: update.periods ?? existing.periods,
    media: update.media ?? existing.media,
    keywords: update.keywords ?? existing.keywords,
    geography: update.geography ?? existing.geography,
    auctionHouseIds: update.auctionHouseIds ?? existing.auctionHouseIds,
    dateRange: update.dateRange ? { ...existing.dateRange, ...update.dateRange } : existing.dateRange,
    price: update.price ? { ...existing.price, ...update.price } : existing.price,
    hardConstraints: update.hardConstraints ?? existing.hardConstraints,
  };
}

function mergeResponse(
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
  criteriaUpdate: Partial<BuyerCriteria> = {},
  conversationUpdate: Partial<BuyerCriteriaConversation> = {},
): BuyerCriteriaResponse {
  return withConversation(
    mergeBuyerCriteria(criteria, criteriaUpdate),
    {
      ...conversation,
      skipped: conversationUpdate.skipped ?? conversation.skipped,
      notes: [...conversation.notes, ...(conversationUpdate.notes ?? [])],
    },
  );
}

export function applyBuyerAnswer(
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
  message: string,
): BuyerCriteriaResponse {
  const field = currentMissingField(criteria, conversation);
  const trimmed = message.trim();
  if (!field || !trimmed) {
    return withConversation(criteria, conversation);
  }

  const criteriaUpdate: Partial<BuyerCriteria> = {};
  switch (field) {
    case 'budget': {
      const price = extractPrice(trimmed);
      if (price) criteriaUpdate.price = price;
      break;
    }
    case 'category': {
      const category = parseCategory(trimmed);
      if (category) {
        criteriaUpdate.categories = appendUnique(criteria.categories, category);
      } else {
        criteriaUpdate.keywords = appendUnique(criteria.keywords, trimmed);
      }
      break;
    }
    case 'creator':
      criteriaUpdate.creators = appendUnique(criteria.creators, trimmed);
      break;
    case 'period': {
      const period = parsePeriod(trimmed) ?? trimmed;
      criteriaUpdate.periods = appendUnique(criteria.periods, period);
      break;
    }
    case 'location':
      criteriaUpdate.geography = appendUnique(criteria.geography, trimmed);
      break;
  }

  return mergeResponse(criteria, conversation, criteriaUpdate, {
    notes: [`Answered ${field}: ${trimmed}`],
  });
}

export function skipCurrentQuestion(
  criteria: BuyerCriteria,
  conversation: BuyerCriteriaConversation,
): BuyerCriteriaResponse {
  const field = currentMissingField(criteria, conversation);
  if (!field || !OPTIONAL_SEARCH_FACTS.includes(field)) {
    return withConversation(criteria, conversation);
  }

  const skipped = [...new Set([...conversation.skipped, field])];
  return withConversation(criteria, { ...conversation, skipped });
}

export function processCriteriaTurn(request: BuyerCriteriaTurnRequest): BuyerCriteriaResponse {
  if (request.action === 'skip') {
    return skipCurrentQuestion(request.criteria, request.conversation);
  }
  return applyBuyerAnswer(request.criteria, request.conversation, request.message ?? '');
}
