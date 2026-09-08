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
    expect(result.structuredAnswer?.missingFacts).toEqual(expect.any(Array));
    expect(result.structuredAnswer?.hasContactDetails).toBe(false);
    expect(result.structuredAnswer?.hasImages).toBe(false);
    expect(isGenerateAiResponseDto(result)).toBe(true);
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
