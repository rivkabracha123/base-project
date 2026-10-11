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
  it('retains explicit corrections during a provider outage', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('blue ring size 8', 'guided-correction');
    await adapter.analyze('good', 'guided-correction');
    await adapter.analyze('no', 'guided-correction');
    const result = await adapter.analyze('Correction: condition damaged and markings include a stamp', 'guided-correction');
    expect(result.item.condition).toContain('damaged');
    expect(result.item.markings).toContain('stamp');
  });
  it('accepts corrections to previously supplied fields while asking a different question', async () => {
    const generate = jest.fn()
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, item: { title: 'Painting', condition: 'good', markings: 'No markings reported' }, missingFacts: ['provenance'] } })
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, item: { title: 'Painting', condition: 'damaged', markings: 'A stamp' }, missingFacts: ['provenance'] } });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('painting in good condition, no markings', 'correction');
    const corrected = await adapter.analyze('Correction: condition damaged and markings include a stamp', 'correction');
    expect(corrected.item.condition).toBe('damaged');
    expect(corrected.item.markings).toBe('A stamp');
    expect(corrected.item.provenance).toBeUndefined();
  });
  it('uses a persisted draft for recommendations after a backend restart', async () => {
    const generate = jest.fn().mockRejectedValue(new ServiceUnavailableException());
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const draft = intake.analyze('old book');
    draft.item.category = 'rare_books';
    adapter.restoreSession('restored-session', draft);
    expect(adapter.hasSession('restored-session')).toBe(true);
    const result = await adapter.analyze('Which auction houses are recommended?', 'restored-session');
    expect(generate).not.toHaveBeenCalled();
    expect(result.functionCall?.object).toEqual({ category: 'rare_books', language: 'en' });
    expect(result.item).toEqual(draft.item);
  });
  it('recommends houses for the known item without asking the AI for more details', async () => {
    const generate = jest.fn(async () => ({
      provider: 'real', mode: 'real', isRelevant: true, error: null,
      structuredAnswer: { ...handoff, category: 'rare_books', item: { title: 'Old manuscript' } },
    }));
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('Old manuscript', 'recommendation-session');
    const result = await adapter.analyze('\u05d0\u05e0\u05d9 \u05e8\u05d5\u05e6\u05d4 \u05d1\u05ea\u05d9 \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05de\u05d5\u05de\u05dc\u05e6\u05d9\u05dd', 'recommendation-session');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.nextQuestion).toBeNull();
    expect(result.functionCall).toEqual({ functionToRun: 'rankSellerHouses', object: { category: 'rare_books', language: 'he' } });
    expect(result.item.title).toBe('Old manuscript');
  });
  it('routes an explicit recommendation request even when the model omits a function', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => ({
        provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff,
      })),
    } as never);
    const result = await adapter.analyze('Which auction houses are recommended for my item?');
    expect(result.functionCall).toEqual({ functionToRun: 'rankSellerHouses', object: { category: 'paintings', language: 'en' } });
  });
  it('stores descriptive answers for each active question through completion during an outage', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('blue ring', 'full-session');
    await adapter.analyze('size 8', 'full-session');
    const condition = await adapter.analyze('good with a scratch in the corner', 'full-session');
    expect(condition.item.condition).toBe('good with a scratch in the corner');
    expect(condition.nextQuestion?.field).toBe('marks');
    await adapter.analyze('no', 'full-session');
    const signed = await adapter.analyze('inside the ring, it says efrat', 'full-session');
    expect(signed.item.signatures).toBe('inside the ring, it says efrat');
    expect(signed.nextQuestion?.field).toBe('provenance');
    const complete = await adapter.analyze('bought from a shop in 2019', 'full-session');
    expect(complete.item.provenance).toBe('bought from a shop in 2019');
    expect(complete.nextQuestion).toBeNull();
    expect(complete.missingFields).toEqual([]);
    expect(complete.confirmedFacts).toEqual({});
  });
  it('accepts a ring size during an outage and retains it for the next turn', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('\u05d8\u05d1\u05e2\u05ea \u05db\u05d7\u05d5\u05dc\u05d4', 'ring-session');
    const result = await adapter.analyze('\u05de\u05d9\u05d3\u05d4 8', 'ring-session');
    expect(result.item.dimensions.values).toEqual([{ label: 'ring_size', value: 8, unit: 'size' }]);
    expect(result.nextQuestion?.field).not.toBe('dimensions');
    const next = await adapter.analyze('\u05de\u05e6\u05d1 \u05d8\u05d5\u05d1', 'ring-session');
    expect(next.item.dimensions.values).toEqual(result.item.dimensions.values);
    expect(next.nextQuestion?.field).not.toBe('dimensions');
    expect(next.nextQuestion?.field).toBe('marks');
    const noMarks = await adapter.analyze('\u05d0\u05d9\u05df', 'ring-session');
    expect(noMarks.item.markings).toBe('No markings reported');
    expect(noMarks.nextQuestion?.field).toBe('signatures');
    const noSignature = await adapter.analyze('\u05d0\u05d9\u05df', 'ring-session');
    expect(noSignature.item.signatures).toBe('No signature reported');
    expect(noSignature.nextQuestion?.field).toBe('provenance');
  });
  it('shares prior dimensions and input across real, guided, and real turns', async () => {
    const dimensions = { values: [{ label: 'width', value: 80, unit: 'cm' }] };
    const generate = jest.fn()
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, missingFacts: ['condition'], item: { title: 'Painting', dimensions } } })
      .mockRejectedValueOnce(new ServiceUnavailableException())
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, missingFacts: [], item: { title: 'Painting', condition: 'good' } } });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('painting width 80 cm', 'shared-session');
    const guided = await adapter.analyze('condition good', 'shared-session');
    expect(guided.item.dimensions.values).toEqual(dimensions.values);
    expect(guided.nextQuestion?.field).not.toBe('dimensions');
    const real = await adapter.analyze('no markings', 'shared-session');
    expect(real.item.dimensions.values).toEqual(dimensions.values);
    expect(generate.mock.calls[2][0].prompt).toContain('condition good');
    expect(generate.mock.calls[2][0].prompt).toContain('painting width 80 cm');
  });
  it.each([{ missingFacts: [] }, { missingFacts: ['unrecognized_detail'] }])('asks for missing item details when AI facts are $missingFacts', async ({ missingFacts }) => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => ({
        provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, missingFacts },
      })),
    } as never);
    const result = await adapter.analyze('I want to sell a blue ring');
    expect(result.missingFields).toContain('dimensions');
    expect(result.nextQuestion?.field).toBe('dimensions');
  });
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
        functionCall,
      })),
    } as never);

    await expect(adapter.analyze('oil painting')).resolves.toEqual(expect.objectContaining({
      structuredAnswer: handoff,
      functionCall,
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
