import {
  applyBuyerAnswer,
  applyCriteriaCorrection,
  applyCriteriaRemoval,
  createGuidedFallbackCriteriaResponse,
  emptyBuyerCriteria,
  parseCriteriaFromAiResponse,
  mergeBuyerCriteria,
  nextFocusedQuestion,
  applyClarificationTurn,
  skipCurrentQuestion,
  type BuyerCriteriaConversation,
} from './buyer-criteria';
import { sampleAiExtractResponses, sampleClarificationTurns, structuredAiExtractSamples } from './buyer-criteria.fixtures';

describe('BuyerCriteria extraction', () => {
  it('treats a 250 dollar budget as a ceiling and replaces an older lower bound during refinement', () => {
    const initial = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const updated = applyClarificationTurn({ ...initial, action: 'answer', message: 'אני רוצה תקציב של 250 דולר' });
    expect(updated.criteria.price).toEqual({ max: 250, currency: 'USD' });
    expect(updated.criteria.categories).toEqual(initial.criteria.categories);
  });
  it.each([
    ['Looking for silver Judaica under $2000', []],
    ['manuscript up to 1900 USD', []],
    ['ספר עד 2000 שקל', []],
    ['manuscript under $12000', []],
    ['manuscript from 1920 under $2000', ['1920']],
  ])('does not read a price as a period in %s', (content, periods) => {
    const result = parseCriteriaFromAiResponse({
      provider: 'fixture', mode: 'fixture', content,
      summary: '', recommendation: '', nextAction: '', confidence: 'medium',
    });
    expect(result.criteria.periods).toEqual(periods);
  });
  it.each([
    ['ספרים', ['rare_books']],
    ['ספר חסידים', ['rare_books']],
    ['old books', ['rare_books']],
    ['ספר לי על מכירות פומביות', []],
  ])('maps book wording in %s', (content, categories) => {
    const result = parseCriteriaFromAiResponse({
      provider: 'fixture', mode: 'fixture', content,
      summary: '', recommendation: '', nextAction: '', confidence: 'medium',
    });
    expect(result.criteria.categories).toEqual(categories);
  });
  it.each([
    ['unknown', [], true],
    ['books', ['rare_books'], false],
    ['manuscripts', ['rare_books'], false],
  ])('normalizes an AI category of %s', (category, categories, asksCategory) => {
    const result = parseCriteriaFromAiResponse({
      provider: 'real', mode: 'real', content: '{}',
      summary: '', recommendation: '', nextAction: '', confidence: 'low',
      structuredAnswer: { role: 'buyer', language: 'he', intent: 'search', category, hasContactDetails: false, hasImages: false },
    } as never);
    expect(result.criteria.categories).toEqual(categories);
    expect(result.conversation.missing.includes('category')).toBe(asksCategory);
  });
  it.each(['אני רוצה כתבי יד עתיקים', 'כתבי יד עתיק', 'כתב יד עתיק'])(
    'recognizes manuscript category and keywords in %s',
    (content) => {
      const result = parseCriteriaFromAiResponse({
        provider: 'fixture', mode: 'fixture', content,
        summary: '', recommendation: '', nextAction: '', confidence: 'medium',
      });

      expect(result.criteria.categories).toEqual(['rare_books']);
      expect(result.criteria.keywords).toContain('manuscript');
      expect(result.conversation.missing).not.toContain('category');
    },
  );

  it('accepts plural Hebrew manuscripts during guided category collection', () => {
    const initial = createGuidedFallbackCriteriaResponse('he');
    const withoutBudget = skipCurrentQuestion(initial.criteria, initial.conversation);
    const result = applyBuyerAnswer(withoutBudget.criteria, withoutBudget.conversation, 'כתבי יד עתיקים');

    expect(result.criteria.categories).toEqual(['rare_books']);
    expect(result.conversation.missing).not.toContain('category');
  });

  it('extracts a basic structured request from a fixture response', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());

    expect(result.criteria.categories).toEqual(['painting']);
    expect(result.criteria.keywords).toEqual(['blue']);
    expect(result.criteria.periods).toEqual(['19th']);
    expect(result.criteria.price).toEqual({ max: 10000, currency: 'USD' });
    expect(result.criteria.language).toBe('en');
    expect(result.conversation.missing).toEqual([]);
    expect(result.conversation.nextQuestion).toBe('I’m looking for matching items based on what you shared.');
  });

  it('preserves existing criteria while asking only for missing useful facts', () => {
    const existing = emptyBuyerCriteria('en');
    existing.price = { min: 5000, max: 20000, currency: 'USD' };
    existing.categories = ['painting'];
    existing.periods = ['19th'];
    existing.keywords = ['blue'];

    const updated = mergeBuyerCriteria(existing, {
      geography: ['Paris'],
    });

    expect(updated.price).toEqual({ min: 5000, max: 20000, currency: 'USD' });
    expect(updated.geography).toEqual(['Paris']);
  });

  it('handles complex fixture with ranges, multiple values, and missing fields', () => {
    const result = parseCriteriaFromAiResponse({
      provider: 'fixture',
      mode: 'fixture',
      content: 'Looking for sculpture, blue or red, from 1920-1930, budget $5k-$15k, location not specified, artist unknown.',
      summary: 'משתמש מחפש פסל כחול או אדום מהשנים 1920-1930, תקציב בין 5 ל- 15 קיי',
      recommendation: 'צריך להבהיר מיקום ואמן',
      nextAction: 'שאל על מיקום ואמן',
      confidence: 'medium',
    });

    expect(result.criteria.categories).toEqual(['sculpture']);
    expect(result.criteria.periods[0]).toMatch(/1920|1930/);
    expect(result.criteria.price).toEqual(expect.objectContaining({
      min: expect.any(Number),
      max: expect.any(Number),
      currency: 'USD',
    }));

    expect(result.conversation.missing).toEqual([]);
    expect(result.conversation.missing).not.toContain('category');
    expect(result.conversation.missing).not.toContain('period');
    expect(result.conversation.missing).not.toContain('budget');
    expect(result.conversation.nextQuestion).toBe('I’m looking for matching items based on what you shared.');
  });
});

describe('Week 3 focused questions', () => {
  it('loads shared fixtures from test helpers', () => {
    const fromFile = sampleAiExtractResponses.paintingEn();
    const fromCode = parseCriteriaFromAiResponse(fromFile);

    expect(fromFile.mode).toBe('fixture');
    expect(fromCode.criteria.categories).toEqual(['painting']);
  });

  it('starts a search without asking for optional details when the item is known', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingHe());

    expect(result.criteria.language).toBe('he');
    expect(result.conversation.missing).toEqual([]);
    expect(result.conversation.nextQuestion).toBe('מחפשת פריטים מתאימים לפי מה שציינת.');
  });

  it('asks only for an item when the search intent is still unknown', () => {
    expect(nextFocusedQuestion(['category'], 'en')).toBe(
      'What kind of item are you looking for — for example a painting or a sculpture?',
    );
    expect(nextFocusedQuestion(['category'], 'he')).toBe(
      'איזה סוג פריט מחפשים — למשל ציור או פסל?',
    );
  });

  it('keeps a vague yes/no answer from becoming an item keyword', () => {
    const criteria = emptyBuyerCriteria('en');
    const updated = applyBuyerAnswer(criteria, {
      skipped: [],
      missing: ['category'],
      nextQuestion: 'What kind of item are you looking for?',
      notes: [],
    }, 'no');

    expect(updated.criteria.keywords).toEqual([]);
    expect(updated.conversation.missing).toEqual(['category']);
  });

  it('still supports focused-question copy for optional preferences if explicitly requested', () => {
    expect(nextFocusedQuestion(['budget', 'category', 'creator'], 'en')).toBe(
      'Is there a budget range I should stay within?',
    );
    expect(nextFocusedQuestion(['budget', 'category', 'creator'], 'he')).toBe(
      'יש טווח תקציב שכדאי להישאר בתוכו?',
    );
  });

  it('accepts optional refinements after search without asking a sequence of questions', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.price = { min: 10000, max: 10000, currency: 'USD' };
    criteria.categories = ['painting'];
    criteria.periods = ['19th'];
    criteria.keywords = ['blue'];

    const afterCreator = applyBuyerAnswer(criteria, {
      skipped: [],
      missing: [],
      nextQuestion: 'מחפשת פריטים מתאימים לפי מה שציינת.',
      notes: [],
    }, 'by Monet');

    expect(afterCreator.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    expect(afterCreator.criteria.creators).toEqual(['Monet']);
    expect(afterCreator.conversation.missing).toEqual([]);
    expect(afterCreator.conversation.nextQuestion).toBe('מחפשת פריטים מתאימים לפי מה שציינת.');
  });

  it('accepts a period refinement after the initial search', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['painting'];
    const updated = applyBuyerAnswer(criteria, {
      skipped: [],
      missing: [],
      nextQuestion: '',
      notes: [],
    }, 'from 1920');

    expect(updated.criteria.periods).toEqual(['1920']);
  });

  it('does not offer optional criteria as blocking questions', () => {
    const initial = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const afterSkip = skipCurrentQuestion(initial.criteria, initial.conversation);

    expect(initial.conversation.missing).toEqual([]);
    expect(afterSkip.conversation.skipped).toEqual([]);
    expect(afterSkip.conversation.missing).toEqual([]);
    expect(afterSkip.conversation.nextQuestion).toBe('I’m looking for matching items based on what you shared.');
    expect(afterSkip.criteria.price).toEqual({ max: 10000, currency: 'USD' });
  });

  it('does not skip category when search intent is still missing', () => {
    const unclear = parseCriteriaFromAiResponse(sampleAiExtractResponses.vagueEn());

    expect(unclear.conversation.missing[0]).toBe('category');

    const afterBudgetSkip = skipCurrentQuestion(unclear.criteria, unclear.conversation);

    expect(afterBudgetSkip.conversation.skipped).toEqual([]);
    expect(afterBudgetSkip.conversation.missing[0]).toBe('category');

    const afterCategorySkipAttempt = skipCurrentQuestion(
      afterBudgetSkip.criteria,
      afterBudgetSkip.conversation,
    );

    expect(afterCategorySkipAttempt.conversation.skipped).toEqual([]);
    expect(afterCategorySkipAttempt.conversation.missing[0]).toBe('category');
  });

  it('extracts keywords from the first message so category is not required twice', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.manuscriptEn());

    expect(result.criteria.categories).toEqual(['rare_books']);
    expect(result.criteria.keywords).toEqual(expect.arrayContaining(['rare', 'Hebrew', 'manuscript']));
    expect(result.conversation.missing).not.toContain('category');
    expect(result.conversation.missing).toEqual([]);
  });

  it('stores a free-text category answer as keywords when no known category matches', () => {
    const afterAnswer = applyClarificationTurn({
      criteria: emptyBuyerCriteria('en'),
      conversation: {
        skipped: ['budget'],
        missing: ['category', 'creator', 'period', 'location'],
        nextQuestion: 'What kind of item are you looking for — for example a painting or a sculpture?',
        notes: [],
      },
      action: 'answer',
      message: 'vintage cameras',
    });

    expect(afterAnswer.criteria.categories).toEqual([]);
    expect(afterAnswer.criteria.keywords).toEqual(['vintage cameras']);
    expect(afterAnswer.conversation.missing).toEqual([]);
  });

  it('uses guided fallback criteria when AI extract is irrelevant', () => {
    const fallback = createGuidedFallbackCriteriaResponse('en');
    expect(fallback.conversation.notes).toContain('guided_fallback');
    expect(fallback.conversation.nextQuestion).toMatch(/What are you looking for/i);
  });

  it('removes budget when the buyer asks to drop it', () => {
    const initial = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const removed = applyCriteriaRemoval(initial.criteria, initial.conversation, 'remove budget');
    expect(removed.criteria.price).toBeUndefined();
    expect(removed.criteria.categories).toEqual(initial.criteria.categories);
  });

  it('applies a budget correction without erasing category', () => {
    const initial = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const corrected = applyCriteriaCorrection(initial.criteria, initial.conversation, 'change budget to $8000');
    expect(corrected.criteria.price?.max).toBe(8000);
    expect(corrected.criteria.price?.min).toBeUndefined();
    expect(corrected.criteria.categories).toEqual(initial.criteria.categories);
  });

  it('accepts clearly worded budget refinements after the search starts', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['painting'];
    const conversation: BuyerCriteriaConversation = {
      skipped: [],
      missing: [],
      nextQuestion: 'I’m looking for matching items based on what you shared.',
      notes: [],
    };

    expect(applyClarificationTurn({ criteria, conversation, action: 'answer', message: 'budget 600' }).criteria.price).toEqual({
      max: 600, currency: 'USD',
    });
    expect(applyClarificationTurn({ criteria, conversation, action: 'answer', message: 'budget 600 thousand' }).criteria.price).toEqual({
      max: 600_000,
      currency: 'USD',
    });
    expect(applyClarificationTurn({ criteria, conversation, action: 'answer', message: 'תקציב 600 אלף' }).criteria.price).toEqual({
      max: 600_000,
      currency: 'USD',
    });
    expect(applyClarificationTurn({ criteria, conversation, action: 'answer', message: 'budget 500-1500' }).criteria.price).toEqual({
      min: 500,
      max: 1500,
      currency: 'USD',
    });
  });

  it('applies answer and skip using shared turn fixtures', () => {
    const afterAnswer = applyClarificationTurn(sampleClarificationTurns.answerMonet());

    expect(afterAnswer.criteria.creators).toEqual(['Monet']);
    expect(afterAnswer.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    expect(afterAnswer.conversation.missing).toEqual([]);

    const afterSkip = applyClarificationTurn(sampleClarificationTurns.skipLocation());

    expect(afterSkip.conversation.skipped).toEqual([]);
    expect(afterSkip.conversation.missing).toEqual([]);
    expect(afterSkip.conversation.nextQuestion).toBe('I’m looking for matching items based on what you shared.');
  });
});

describe('Week 4 hardConstraints', () => {
  it('derives constraints from confirmed criteria fields', () => {
    const extracted = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());

    expect(extracted.criteria.hardConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price', operator: 'range' }),
        expect.objectContaining({ field: 'categories', operator: 'contains' }),
        expect.objectContaining({ field: 'periods', operator: 'contains' }),
      ]),
    );
  });

  it('preserves price constraints after a refinement turn', () => {
    const extracted = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const afterTurn = applyClarificationTurn({
      criteria: extracted.criteria,
      conversation: extracted.conversation,
      action: 'answer',
      message: 'Monet',
    });

    expect(afterTurn.criteria.price).toEqual(extracted.criteria.price);
    expect(afterTurn.criteria.hardConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price', operator: 'range' }),
        expect.objectContaining({ field: 'creators', operator: 'contains', value: ['Monet'] }),
      ]),
    );
  });

  it('derives hardConstraints from structured AI extract fields', () => {
    const extracted = parseCriteriaFromAiResponse(structuredAiExtractSamples.blueRingHe());

    expect(extracted.criteria.hardConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'categories', value: ['טבעות'] }),
      ]),
    );
  });
});
