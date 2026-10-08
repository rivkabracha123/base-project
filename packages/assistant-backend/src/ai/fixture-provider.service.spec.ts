import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService } from './fixture-provider.service';

//test fixture provider service
describe('FixtureProviderService', () => {
  it('advances seller questions using facts from earlier turns', async () => {
    const result = await new FixtureProviderService().generate({
      role: 'seller', language: 'en', prompt: 'It is in good condition',
      history: [{ prompt: 'I want to sell a painting 60 x 80 cm', answer: 'What is the condition of the item?' }],
    });
    expect(result.nextAction).toBe('What is known about the item provenance?');
    expect(result.structuredAnswer.item).toEqual(expect.objectContaining({ dimensions: 'provided', condition: 'provided' }));
  });
  it('asks a Hebrew pink-ring buyer for budget and optional period', async () => {
    const result = await new FixtureProviderService().generate({ prompt: 'אני מחפש טבעת וורודה', role: 'buyer', language: 'he' });
    expect(result.summary).toContain('טבעת ורודה');
    expect(result.nextAction).toContain('מה התקציב');
    expect(result.nextAction).toContain('שנה או תקופה');
    expect(result.nextAction).toContain('אין העדפה');
  });

  it.each([
    ['אני מחפשת טבעת עד 5000 שקל', false, true],
    ['אני מחפשת טבעת משנת 2021', true, false],
    ['אני מחפשת טבעת משנת 2021 עד 5000 שקל', false, false],
    ['אני מחפשת טבעת וינטג עד 5000 שקל', false, false],
    ['אני מחפשת טבעת ללא הגבלת תקציב ולא משנה השנה', false, false],
  ])('only asks for missing buyer preferences: %s', async (prompt, budget, period) => {
    const result = await new FixtureProviderService().generate({ prompt, role: 'buyer', language: 'he' });
    expect(result.nextAction.includes('מה התקציב')).toBe(budget);
    expect(result.nextAction.includes('שנה או תקופה')).toBe(period);
  });

  it('asks focused questions in English too', async () => {
    const result = await new FixtureProviderService().generate({ prompt: 'I want a pink ring', role: 'buyer', language: 'en' });
    expect(result.nextAction).toContain('What is your budget');
    expect(result.nextAction).toContain('preferred year or period');
  });

  it('understands the English pink ring request and returns English display text', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'I am looking for a pink ring for up to 5,000 shekels.', role: 'buyer', language: 'en',
    });
    expect(result.isRelevant).toBe(true);
    expect(result.structuredAnswer).toEqual(expect.objectContaining({
      category: 'rings', keywords: ['pink'], price: { max: 5000, currency: 'ILS' },
    }));
    expect(result.summary).toContain('pink ring');
    for (const text of [result.content, result.summary, result.recommendation, result.nextAction]) {
      expect(text).not.toMatch(/[\u0590-\u05ff]/);
    }
    expect(isGenerateAiResponseDto(result, 'buyer')).toBe(true);
  });

  it.each([
    ['a ring', 'rings', undefined],
    ['a blue painting', 'paintings', ['blue']],
    ['a pink ring', 'rings', ['pink']],
  ])('keeps English item type independent of color: %s', async (description, category, keywords) => {
    const result = await new FixtureProviderService().generate({ prompt: `I want ${description}`, role: 'buyer', language: 'en' });
    expect(result.structuredAnswer.category).toBe(category);
    expect(result.structuredAnswer.keywords).toEqual(keywords);
    expect(result.nextAction).not.toMatch(/[\u0590-\u05ff]/);
  });

  it.each([
    ['בין 5000 שקל ל8000 שקל', { min: 5000, max: 8000, currency: 'ILS' }],
    ['בין 5000 אלף שקל ל8000 אלף שקל', { min: 5000000, max: 8000000, currency: 'ILS' }],
    ['בין 5000 אלף שקל עד 8000 אלף שקל', { min: 5000000, max: 8000000, currency: 'ILS' }],
    ['בין 5 ל־8 אלף שקל', { min: 5000, max: 8000, currency: 'ILS' }],
    ['500 שקל עד 8 אלף שקל', { min: 500, max: 8000, currency: 'ILS' }],
    ['עד 500 אלף שקל', { max: 500000, currency: 'ILS' }],
    ['עד 2.5 מיליון שקל', { max: 2500000, currency: 'ILS' }],
    ['בתקציב 750 שקל', { max: 750, currency: 'ILS' }],
    ['5,000-8,000 שקל', { min: 5000, max: 8000, currency: 'ILS' }],
    ['budget between $500 and $800', { min: 500, max: 800, currency: 'USD' }],
    ['budget up to $750', { max: 750, currency: 'USD' }],
    ['', undefined],
    ['התקציב עדיין לא ידוע', undefined],
  ])('extracts the actual buyer budget from %s', async (budget, expected) => {
    const result = await new FixtureProviderService().generate({
      prompt: `אני מחפשת טבעת כחולה משנת 2021 ${budget}`,
      role: 'buyer',
      language: 'he',
    });
    expect(result.structuredAnswer.price).toEqual(expected);
    expect(result.structuredAnswer.periods).toEqual(['2021']);
    if (expected) expect(result.nextAction).not.toContain('בקש מידע נוסף על תקציב');
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });
//test returns a deterministic fixture response
  it('returns a deterministic fixture response for a blue ring search', async () => {
    const service = new FixtureProviderService();

    const result = await service.generate({
      prompt: 'טבעת כחולה משנת 2021',
      language: 'he',
    });

    expect(result.provider).toBe('fixture');
    expect(result.mode).toBe('fixture');
    expect(result.content).toContain('טבעת כחולה');
    expect(result.content).toContain('2021');
  });
//test unrelated requests
  it('marks unrelated requests instead of treating them as item searches', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'מה מזג האוויר היום?',
      role: 'buyer',
      language: 'he',
    });

    expect(result.isRelevant).toBe(false);
    expect(result.error).toBe('השאלה אינה קשורה לקנייה או למכירה של פריטים.');
    expect(result.confidence).toBe('low');
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });

  //test Checks that a Hebrew buyer request creates a valid contract
  it('returns a valid Hebrew buyer answer structure with deterministic fixture data', async () => {
    const service = new FixtureProviderService();

    const result = await service.generate({
      prompt: 'אני מחפש טבעת כחולה משנת 2021, תקציב עד 5000 ש"ח',
      language: 'he',
    });

    expect(result.structuredAnswer).toEqual(
      expect.objectContaining({
        language: 'he',
        category: expect.any(String),
        hasContactDetails: false,
        hasImages: false,
      }),
    );
    expect(result.structuredAnswer?.periods).toEqual(['2021']);
    expect(result.structuredAnswer?.price).toEqual({ max: 5000, currency: 'ILS' });
    expect(result.structuredAnswer?.hasContactDetails).toBe(false);
    expect(result.structuredAnswer?.hasImages).toBe(false);
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });
  //test Checks that provided Hebrew buyer facts are extracted
  it('extracts provided facts for a Hebrew buyer', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'אני מחפש טבעת כחולה משנת 2021 בתקציב עד 5000 שקל',
      role: 'buyer',
      language: 'he',
    });

    expect(result.structuredAnswer).toEqual(expect.objectContaining({
      role: 'buyer',
      category: 'טבעות',
      periods: ['2021'],
      price: { max: 5000, currency: 'ILS' },
      keywords: ['blue'],
    }));
  });

  //test Checks that an English buyer request creates a valid  contract
  it('returns a valid English buyer answer structure with deterministic fixture data', async () => {
    const service = new FixtureProviderService();

    const result = await service.generate({
      prompt: 'I want a blue ring from 2021, budget up to $5000',
      language: 'en',
    });

    expect(result.structuredAnswer).toEqual(
      expect.objectContaining({
        language: 'en',
        category: expect.any(String),
        hasContactDetails: false,
        hasImages: false,
      }),
    );
    expect(result.structuredAnswer?.intent).toContain('blue');
    expect(result.structuredAnswer?.hasContactDetails).toBe(false);
    expect(result.structuredAnswer?.hasImages).toBe(false);
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });
//test for valid answer
  it('returns a valid seller answer structure for the seller handoff', async () => {
    const service = new FixtureProviderService();

    const result = await service.generate({
      prompt: 'I have a blue painting to sell',
      role: 'seller',
      language: 'en',
    });

    expect(result.structuredAnswer).toEqual(
      expect.objectContaining({
        role: 'seller',
        category: 'paintings',
        item: expect.objectContaining({ title: 'Blue item' }),
        missingFacts: ['dimensions', 'condition', 'provenance'],
      }),
    );
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });
//test for missing, required and optional
  it('blocks functions for missing required seller facts but ignores missing optional provenance', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'I have a blue painting to sell',
      role: 'seller',
      language: 'en',
    });

    expect(result.structuredAnswer.completionState).toEqual(expect.objectContaining({
      blockingFields: ['dimensions', 'condition'],
      readyForFunctions: false,
    }));
    expect(result.structuredAnswer.completionState?.fields.provenance).toEqual(expect.objectContaining({
      required: false,
      status: 'missing',
    }));
  });
//test after required seller facts
  it('allows functions after required seller facts are provided', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'I have a blue painting to sell, 20 x 30 cm, in good condition',
      role: 'seller',
      language: 'en',
    });

    expect(result.structuredAnswer.completionState).toEqual(expect.objectContaining({
      blockingFields: [],
      readyForFunctions: true,
    }));
  });
  //test missing iteam
  it('recognizes a Hebrew seller painting and keeps only missing item facts', async () => {
    const result = await new FixtureProviderService().generate({
      prompt: 'יש לי ציור כחול למכירה ואני רוצה להכניס אותו למכירה פומבית',
      role: 'seller',
      language: 'he',
    });

    expect(result.structuredAnswer).toEqual(expect.objectContaining({
      role: 'seller',
      category: 'paintings',
      item: expect.objectContaining({ title: 'ציור כחול' }),
      missingFacts: ['dimensions', 'condition', 'provenance'],
    }));
    expect(isGenerateAiResponseDto(result)).toBe(true);
  });

  //test Checks that an invalid structured answer is rejected before being passed forward 
  it('rejects malformed buyer answer structures before they reach downstream consumers', () => {
    expect(
      isGenerateAiResponseDto({
        provider: 'fixture',
        mode: 'fixture',
        content: 'bad payload',
        summary: 'bad summary',
        recommendation: 'bad recommendation',
        nextAction: 'bad next action',
        confidence: 'medium',
        structuredAnswer: {
          language: 'he',

          //the problem is here - empty 
          intent: '',
          category: 'rings',
          missingFacts: [],
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    ).toBe(false);
  });
  // Rejects seller payloads with invalid field types.
  it('rejects a seller answer with incorrectly typed item fields', () => {
    expect(
      isGenerateAiResponseDto({
        provider: 'fixture',
        mode: 'fixture',
        content: 'seller payload',
        summary: 'seller summary',
        recommendation: 'seller recommendation',
        nextAction: 'seller next action',
        confidence: 'medium',
        structuredAnswer: {
          role: 'seller',
          language: 'he',
          intent: 'Prepare an item for auction review.',
          category: 'paintings',
          item: { dimensions: 80 },
          missingFacts: [],
          confirmedFacts: [],
          uncertainFacts: [],
          sellerConfirmation: { required: true, status: 'pending' },
          hasContactDetails: false,
          hasImages: false,
        },
      }),
    ).toBe(false);
  });
  // The structured answer must match the requested role.
  it('rejects a response whose structured role does not match the requested role', () => {
    expect(
      isGenerateAiResponseDto(
        {
          provider: 'fixture',
          mode: 'fixture',
          content: 'buyer payload',
          summary: 'buyer summary',
          recommendation: 'buyer recommendation',
          nextAction: 'buyer next action',
          confidence: 'medium',
          structuredAnswer: {
            role: 'buyer',
            language: 'he',
            intent: 'Find a painting',
            hasContactDetails: false,
            hasImages: false,
          },
        },
        'seller',
      ),
    ).toBe(false);
  });
});
