function object(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const text = { type: 'string', minLength: 1 };
const optionalText = { type: ['string', 'null'] };
const strings = { type: ['array', 'null'], items: { type: 'string' } };
const field = object({
  required: { type: 'boolean' },
  status: { type: 'string', enum: ['provided', 'skipped', 'missing', 'uncertain'] },
  value: { type: ['string', 'number', 'null'] },
});

/** Nullable optional fields are omitted before passing to the existing domain contract. */
export const buyerResponseSchema = object({
  isRelevant: { type: 'boolean' },
  error: optionalText,
  summary: text,
  recommendation: text,
  nextAction: text,
  confidence: { type: 'string', enum: ['low', 'medium'] },
  structuredAnswer: object({
    role: { type: 'string', enum: ['buyer'] },
    language: { type: 'string', enum: ['he', 'en'] },
    intent: text,
    category: optionalText,
    creators: strings,
    periods: strings,
    keywords: strings,
    geography: strings,
    price: { ...object({
      min: { type: ['number', 'null'] },
      max: { type: ['number', 'null'] },
      currency: optionalText,
    }), type: ['object', 'null'] },
    hasContactDetails: { type: 'boolean' },
    hasImages: { type: 'boolean' },
    completionState: object({
      fields: object({ category: field, budget: field, period: field, creators: field, keywords: field, geography: field }),
      blockingFields: { type: 'array', items: { type: 'string' } },
      readyForFunctions: { type: 'boolean' },
    }),
  }),
});

export function buyerResponseExample(language: 'he' | 'en') {
  return {
    isRelevant: true, error: null, summary: 'The buyer wants a painting.',
    recommendation: 'Search the catalog using the supplied criteria.',
    nextAction: 'Is there a preferred period?', confidence: 'low',
    structuredAnswer: {
      role: 'buyer', language, intent: 'Find a painting', category: 'paintings',
      creators: null, periods: null, keywords: null, geography: null,
      price: { min: null, max: 500, currency: 'ILS' },
      hasContactDetails: false, hasImages: false,
      completionState: {
        fields: Object.fromEntries(['category', 'budget', 'period', 'creators', 'keywords', 'geography'].map(name => [name, {
          required: name === 'category', status: name === 'category' || name === 'budget' ? 'provided' : 'missing',
          value: name === 'category' ? 'paintings' : name === 'budget' ? 500 : null,
        }])),
        blockingFields: [], readyForFunctions: true,
      },
    },
  };
}

export function omitNullableBuyerFields(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const answer = { ...value } as Record<string, unknown>;
  for (const key of ['category', 'creators', 'periods', 'keywords', 'geography', 'price']) {
    if (answer[key] === null) delete answer[key];
  }
  if (answer.price && typeof answer.price === 'object' && !Array.isArray(answer.price)) {
    const price = { ...answer.price } as Record<string, unknown>;
    for (const key of ['min', 'max', 'currency']) if (price[key] === null) delete price[key];
    answer.price = price;
  }
  return answer;
}
