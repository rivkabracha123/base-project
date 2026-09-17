import {
  applyBuyerAnswer,
  emptyBuyerCriteria,
  parseCriteriaFromAiResponse,
  mergeBuyerCriteria,
  nextFocusedQuestion,
  applyClarificationTurn,
  skipCurrentQuestion,
} from './buyer-criteria';
import { sampleAiExtractResponses, sampleClarificationTurns, structuredAiExtractSamples } from './buyer-criteria.fixtures';

describe('BuyerCriteria extraction', () => {
  it('extracts a basic structured request from a fixture response', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());

    expect(result.criteria.categories).toEqual(['painting']);
    expect(result.criteria.keywords).toEqual(['blue']);
    expect(result.criteria.periods).toEqual(['19th']);
    expect(result.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    expect(result.criteria.language).toBe('en');
    expect(result.conversation.missing).toEqual(['creator', 'location']);
    expect(result.conversation.nextQuestion).toBe('Is there a specific artist or maker?');
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

    expect(result.conversation.missing).toEqual(['creator', 'location']);
    expect(result.conversation.missing).not.toContain('category');
    expect(result.conversation.missing).not.toContain('period');
    expect(result.conversation.missing).not.toContain('budget');
    expect(result.conversation.nextQuestion).toBe('Is there a specific artist or maker?');
  });
});

describe('Week 3 focused questions', () => {
  it('loads shared fixtures from test helpers', () => {
    const fromFile = sampleAiExtractResponses.paintingEn();
    const fromCode = parseCriteriaFromAiResponse(fromFile);

    expect(fromFile.mode).toBe('fixture');
    expect(fromCode.criteria.categories).toEqual(['painting']);
  });

  it('asks one Hebrew question for the first missing search fact', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingHe());

    expect(result.criteria.language).toBe('he');
    expect(result.conversation.missing[0]).toBe('creator');
    expect(result.conversation.nextQuestion).toBe('יש אמן או יוצר מסוים?');
    expect(result.conversation.nextQuestion).not.toMatch(/את |אתה |את מחפש|אתה מחפש/);
  });

  it('asks only about budget when search facts are still empty', () => {
    expect(nextFocusedQuestion(['budget', 'category', 'creator'], 'en')).toBe(
      'Is there a budget range I should stay within?',
    );
    expect(nextFocusedQuestion(['budget', 'category', 'creator'], 'he')).toBe(
      'יש טווח תקציב שכדאי להישאר בתוכו?',
    );
  });

  it('moves to the next missing fact after one answer, without erasing price', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.price = { min: 10000, max: 10000, currency: 'USD' };
    criteria.categories = ['painting'];
    criteria.periods = ['19th'];
    criteria.keywords = ['blue'];

    const afterCreator = applyBuyerAnswer(criteria, {
      skipped: [],
      missing: ['creator', 'location'],
      nextQuestion: 'יש אמן או יוצר מסוים?',
      notes: [],
    }, 'Monet');

    expect(afterCreator.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    expect(afterCreator.criteria.creators).toEqual(['Monet']);
    expect(afterCreator.conversation.missing).toEqual(['location']);
    expect(afterCreator.conversation.nextQuestion).toBe('יש מקום או מקור שחשוב?');
  });

  it('skips an optional question and moves to the next missing fact', () => {
    const initial = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingEn());
    const afterSkip = skipCurrentQuestion(initial.criteria, initial.conversation);

    expect(initial.conversation.missing[0]).toBe('creator');
    expect(afterSkip.conversation.skipped).toEqual(['creator']);
    expect(afterSkip.conversation.missing).toEqual(['location']);
    expect(afterSkip.conversation.nextQuestion).toBe('Is there a place or origin that matters?');
    expect(afterSkip.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
  });

  it('does not skip category when search intent is still missing', () => {
    const unclear = parseCriteriaFromAiResponse(sampleAiExtractResponses.vagueEn());

    expect(unclear.conversation.missing[0]).toBe('budget');

    const afterBudgetSkip = skipCurrentQuestion(unclear.criteria, unclear.conversation);

    expect(afterBudgetSkip.conversation.skipped).toEqual(['budget']);
    expect(afterBudgetSkip.conversation.missing[0]).toBe('category');

    const afterCategorySkipAttempt = skipCurrentQuestion(
      afterBudgetSkip.criteria,
      afterBudgetSkip.conversation,
    );

    expect(afterCategorySkipAttempt.conversation.skipped).toEqual(['budget']);
    expect(afterCategorySkipAttempt.conversation.missing[0]).toBe('category');
  });

  it('extracts keywords from the first message so category is not required twice', () => {
    const result = parseCriteriaFromAiResponse(sampleAiExtractResponses.manuscriptEn());

    expect(result.criteria.categories).toEqual([]);
    expect(result.criteria.keywords).toEqual(expect.arrayContaining(['rare', 'Hebrew', 'manuscript']));
    expect(result.conversation.missing).not.toContain('category');
    expect(result.conversation.missing[0]).toBe('creator');
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
      message: 'rare Hebrew books',
    });

    expect(afterAnswer.criteria.categories).toEqual([]);
    expect(afterAnswer.criteria.keywords).toEqual(['rare Hebrew books']);
    expect(afterAnswer.conversation.missing[0]).toBe('creator');
  });

  it('applies answer and skip using shared turn fixtures', () => {
    const afterAnswer = applyClarificationTurn(sampleClarificationTurns.answerMonet());

    expect(afterAnswer.criteria.creators).toEqual(['Monet']);
    expect(afterAnswer.criteria.price).toEqual({ min: 10000, max: 10000, currency: 'USD' });
    expect(afterAnswer.conversation.missing).toEqual(['location']);

    const afterSkip = applyClarificationTurn(sampleClarificationTurns.skipLocation());

    expect(afterSkip.conversation.skipped).toEqual(['location']);
    expect(afterSkip.conversation.missing).toEqual([]);
    expect(afterSkip.conversation.nextQuestion).toBe('I have the main search facts. Should I continue?');
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
