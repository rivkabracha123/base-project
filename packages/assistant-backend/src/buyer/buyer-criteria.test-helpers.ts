import type { BuyerCriteriaTurnRequest, P4FixtureResponse } from './buyer-criteria';

export const week3P4Fixtures = {
  paintingEn: (): P4FixtureResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
    summary: 'painting search',
    recommendation: 'ask creator',
    nextAction: 'ask creator',
    confidence: 'medium',
  }),
  paintingHe: (): P4FixtureResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'אני מחפשת ציור כחול מהמאה ה-19 עד 10000 שקל',
    summary: 'ציור כחול, מאה 19',
    recommendation: 'בקש אמן',
    nextAction: 'שאל על אמן',
    confidence: 'medium',
  }),
  vagueEn: (): P4FixtureResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'Looking for something interesting for my collection.',
    summary: 'vague request',
    recommendation: 'clarify',
    nextAction: 'clarify',
    confidence: 'medium',
  }),
  manuscriptEn: (): P4FixtureResponse => ({
    provider: 'fixture',
    mode: 'fixture',
    content: 'Looking for rare Hebrew manuscript under $15k.',
    summary: 'manuscript search',
    recommendation: 'ask creator',
    nextAction: 'ask creator',
    confidence: 'medium',
  }),
};

export const week3TurnFixtures = {
  answerMonet: (): BuyerCriteriaTurnRequest => ({
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
  skipLocation: (): BuyerCriteriaTurnRequest => ({
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
