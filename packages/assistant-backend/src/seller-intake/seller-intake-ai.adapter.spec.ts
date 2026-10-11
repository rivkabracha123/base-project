import { ServiceUnavailableException } from '@nestjs/common';
import { mapAiFactsToIntakeFields, SellerIntakeAiAdapter } from './seller-intake-ai.adapter';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeService } from './seller-intake.service';
import type { SellerHandoffContract } from '../ai/seller-handoff';

const handoff: SellerHandoffContract = {
  role: 'seller',
  language: 'en',
  intent: 'describe item',
  category: 'paintings',
  item: { title: 'Oil painting' },
  missingFacts: ['markings', 'signature', 'unknown_fact'],
  confirmedFacts: ['category'],
  uncertainFacts: [],
  sellerConfirmation: { required: true, status: 'pending' },
  hasContactDetails: false,
  hasImages: false,
};

describe('SellerIntakeAiAdapter', () => {
  const intake = new SellerIntakeAiMock(new SellerIntakeService());
//test Maps seller field names

  it('maps markings -> marks and signature -> signatures', () => {
    expect(mapAiFactsToIntakeFields(['markings', 'signature', 'dimensions', 'x'])).toEqual(['marks', 'signatures', 'dimensions']);
  });
//test Preserves draft, adds AI
  it('keeps the S1 draft and attaches the AI handoff separately', async () => {
    const generate = jest.fn(async () => ({
      provider: 'fixture', mode: 'fixture', isRelevant: true, error: null, structuredAnswer: handoff,
    }));
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const baseline = intake.analyze('oil painting 60x80');
    const result = await adapter.analyze('oil painting 60x80', undefined);

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'oil painting 60x80',
      language: 'en',
    }));
    expect(result.structuredAnswer).toEqual(handoff);
    expect(result.ai.aiMissingFields).toEqual(['marks', 'signatures']);
    expect(result.missingFields).toEqual(['marks', 'signatures']);
    expect(result.item.dimensions.values).toEqual([]);
  });

  it('uses AI-extracted axes and units for the draft instead of parsing dimensions from text', async () => {
    const measurements = [
      { label: 'length', value: 125, unit: 'cm' },
      { label: 'width', value: 40, unit: 'cm' },
      { label: 'depth', value: 12, unit: 'mm' },
    ];
    const aiResponse = {
      ...handoff,
      item: { ...handoff.item, dimensions: { values: measurements } },
      missingFacts: ['condition', 'provenance'],
    };
    const generate = jest.fn(async () => ({
      provider: 'real', mode: 'real', isRelevant: true, error: null,
      structuredAnswer: aiResponse,
    }));
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const result = await adapter.analyze('האורך 125, הרוחב 40, והעומק 12');

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'האורך 125, הרוחב 40, והעומק 12',
    }));
    expect(result.item.dimensions.values).toEqual(measurements);
    expect(result.missingFields).not.toContain('dimensions');
    expect(result.nextQuestion?.field).toBe('condition');
  });

  it('preserves a requested function call from AiService', async () => {
    const functionCall = { functionToRun: 'listEvidence', object: { itemId: 'item-1' } };
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => ({
        provider: 'real', mode: 'real', isRelevant: true, error: null,
        content: 'ok', summary: 'ok', recommendation: 'ok', nextAction: 'ok', confidence: 'medium',
        structuredAnswer: handoff,
      })),
    } as never);

    await expect(adapter.analyze('oil painting')).resolves.toEqual(expect.objectContaining({
      structuredAnswer: handoff,
    }));
  });
//test alls back on failure
  it('continues with guided intake when the real AI provider is unavailable', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => {
        throw new ServiceUnavailableException('provider unavailable');
      }),
    } as never);

    await expect(adapter.analyze('ציור שמן')).resolves.toEqual(expect.objectContaining({
      provider: 'fixture-mock',
      ai: expect.objectContaining({
        provider: 'fixture',
        mode: 'fixture',
        error: 'Real AI is temporarily unavailable; guided seller intake was used.',
      }),
    }));
  });
});
