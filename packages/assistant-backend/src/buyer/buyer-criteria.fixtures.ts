import type { CriteriaConversationTurn, StructuredHandoffAnswer, UpstreamHandoffResponse } from './buyer-criteria';

export const sampleHandoffResponses = {
  paintingEn: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
    summary: 'painting search',
    recommendation: 'ask creator',
    nextAction: 'ask creator',
    confidence: 'medium',
  }),
  paintingHe: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'אני מחפשת ציור כחול מהמאה ה-19 עד 10000 שקל',
    summary: 'ציור כחול, מאה 19',
    recommendation: 'בקש אמן',
    nextAction: 'שאל על אמן',
    confidence: 'medium',
  }),
  vagueEn: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'Looking for something interesting for my collection.',
    summary: 'vague request',
    recommendation: 'clarify',
    nextAction: 'clarify',
    confidence: 'medium',
  }),
  manuscriptEn: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'Looking for rare Hebrew manuscript under $15k.',
    summary: 'manuscript search',
    recommendation: 'ask creator',
    nextAction: 'ask creator',
    confidence: 'medium',
  }),
};

export const structuredHandoffSamples = {
  blueRingHe: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    isRelevant: true,
    error: null,
    content: 'תוצאה קבועה (fixture): טבעת כחולה.',
    summary: 'המשתמש מחפש פריט קשור לצבע כחול',
    recommendation: 'הצג פריטים דומים עם צבע כחול או בקש פרטים נוספים',
    nextAction: 'בקש מידע נוסף על תקציב והזדמנות לרכישה',
    confidence: 'medium',
    structuredAnswer: {
      role: 'buyer',
      language: 'he',
      intent: 'מצא טבעת כחולה המתאימה לתקופה ולתקציב המבוקש.',
      category: 'טבעות',
      keywords: ['blue'],
      hasContactDetails: false,
      hasImages: false,
    } satisfies StructuredHandoffAnswer,
  }),
  irrelevantHe: (): UpstreamHandoffResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    isRelevant: false,
    error: 'השאלה אינה קשורה לקנייה או למכירה',
    content: '',
    summary: '',
    recommendation: '',
    nextAction: '',
    confidence: 'low',
  }),
};

export const sampleConversationTurns = {
  answerMonet: (): CriteriaConversationTurn => ({
    action: 'answer',
    message: 'Monet',
    criteria: {
      categories: ['painting'],
      creators: [],
      periods: ['19th'],
      media: [],
      keywords: ['blue'],
      geography: [],
      auctionHouseIds: [],
      price: { min: 10000, max: 10000, currency: 'USD' },
      language: 'en',
      hardConstraints: [],
    },
    conversation: {
      skipped: [],
      missing: ['creator', 'location'],
      nextQuestion: 'Is there a specific artist or maker?',
      notes: ['painting search'],
    },
  }),
  skipLocation: (): CriteriaConversationTurn => ({
    action: 'skip',
    criteria: {
      categories: ['painting'],
      creators: ['Monet'],
      periods: ['19th'],
      media: [],
      keywords: ['blue'],
      geography: [],
      auctionHouseIds: [],
      price: { min: 10000, max: 10000, currency: 'USD' },
      language: 'en',
      hardConstraints: [],
    },
    conversation: {
      skipped: [],
      missing: ['location'],
      nextQuestion: 'Is there a place or origin that matters?',
      notes: ['painting search', 'Answered creator: Monet'],
    },
  }),
};

/** Example used in refinement integration tests: initial handoff + one buyer answer. */
export const refinementExample = {
  initialHandoff: sampleHandoffResponses.paintingEn(),
  buyerAnswer: 'Monet',
} as const;
