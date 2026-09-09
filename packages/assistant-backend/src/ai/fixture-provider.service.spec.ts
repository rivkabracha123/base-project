import { isGenerateAiResponseDto } from './ai.dto';
import { FixtureProviderService } from './fixture-provider.service';

//test fixture provider service
describe('FixtureProviderService', () => {
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
});
