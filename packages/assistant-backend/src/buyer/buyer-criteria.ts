export interface BuyerBudget {
  min?: number;
  max?: number;
}

export interface BuyerCriteria {
  budget?: BuyerBudget;
  category?: string | null;
  creator?: string | null;
  period?: string | null;
  media?: string;
  keywords?: string[];
  geography?: string;
  location?: string | null;
  color?: string | null;
  notes?: string[];
  missing: string[];
  nextQuestion?: string;
}

export type P4FixtureResponse = {
  provider: 'fixture' | 'real';
  mode: 'fixture' | 'real';
  content: string;
  summary: string;
  recommendation: string;
  nextAction: string;
  confidence: 'low' | 'medium';
};

const toNumber = (value: string): number | undefined => {
  const normalized = value.replace(/[$,\s]/g, '').replace(/k/i, '000');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractBudget = (text: string): BuyerBudget | undefined => {
  const matches = [...text.matchAll(/\$?\d[\d,]*(?:k)?/gi)]
    .map((match) => match[0])
    .filter((value) => {
      const lower = value.toLowerCase();
      return !/\d+(st|nd|rd|th)\b/i.test(value) && !/^\d{4}$/.test(value.replace(/[$,]/g, '')) &&
        (lower.includes('$') || lower.includes('k') || value.length > 3);
    });
  const values = matches.map(toNumber).filter((value): value is number => value !== undefined);

  return values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : undefined;
};

const parseCategory = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (lower.includes('painting') || lower.includes('ציור') || lower.includes('תמונה')) return 'painting';
  if (lower.includes('sculpture') || lower.includes('פסל')) return 'sculpture';
  return null;
};

const parseColor = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (lower.includes('blue') || lower.includes('כחול')) return 'blue';
  if (lower.includes('red') || lower.includes('אדום')) return 'red';
  if (lower.includes('green') || lower.includes('ירוק')) return 'green';
  return null;
};

const parsePeriod = (text: string): string | null => {
  const match = text.match(/(19th|20th|(?:19|20)\d{2})/i);
  if (!match) return null;
  const value = match[0].toLowerCase();
  return value.includes('19th') ? '19th' : value.includes('20th') ? '20th' : value;
};

const buildMissingFields = (criteria: BuyerCriteria): string[] => {
  const missing: string[] = [];
  if (!criteria.creator) missing.push('creator');
  if (!criteria.location) missing.push('location');
  if (!criteria.period) missing.push('period');
  return missing;
};

function withNextQuestion(criteria: BuyerCriteria): BuyerCriteria {
  const missing = buildMissingFields(criteria);
  return {
    ...criteria,
    missing,
    nextQuestion: missing.length > 0
      ? `Do you want to refine the ${missing.join(' and ')} before I continue?`
      : 'I have the main criteria. Would you like me to continue with search options?',
  };
}

export function extractBuyerCriteriaFromFixture(response: P4FixtureResponse): BuyerCriteria {
  const text = `${response.content} ${response.summary} ${response.recommendation} ${response.nextAction}`;
  return withNextQuestion({
    budget: extractBudget(text),
    category: parseCategory(text),
    creator: null,
    period: parsePeriod(text),
    location: null,
    color: parseColor(text),
    notes: [response.summary],
    missing: [],
  });
}

export function mergeBuyerCriteria(existing: BuyerCriteria, update: Partial<BuyerCriteria>): BuyerCriteria {
  return withNextQuestion({
    ...existing,
    ...update,
    budget: update.budget ? { ...existing.budget, ...update.budget } : existing.budget,
    notes: [...(existing.notes ?? []), ...(update.notes ?? [])],
  });
}
