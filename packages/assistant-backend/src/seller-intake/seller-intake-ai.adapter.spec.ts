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
  it('does not reuse the saved item to recommend houses for an auction-record question', async () => {
    const generate = jest.fn().mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff })
      .mockResolvedValue({ provider: 'real', mode: 'real', isRelevant: true, error: null, summary: 'A historical auction record.',
        functionCall: { functionToRun: 'rankSellerHouses', object: { category: 'paintings' } },
        structuredAnswer: { ...handoff, intent: 'recommend an auction house' } });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('I have a painting', 'record-session');
    const result = await adapter.analyze('איזה מוצר נמכר בסכום הכי גבוה אי פעם במכירה פומבית ובאיזה בית מכירות?', 'record-session');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.ai.generalInformation).toBe(true);
    expect(result.functionCall).toBeNull();
  });
  it('does not start item intake when a general auction question encounters an AI outage', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    const result = await adapter.analyze('איזה פריט הכי יקר נמכר במכירה פומבית ובאיזה בית מכירות?');
    expect(result.ai.generalInformation).toBe(true);
    expect(result.ai.summary).toContain('אינו זמין');
    expect(result.nextQuestion).toBeNull();
    expect(result.functionCall).toBeNull();
  });
  it('answers general auction questions without changing the item or interrupting intake', async () => {
    const generate = jest.fn().mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff })
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        summary: 'An auction reserve is the minimum price accepted by the seller.', nextAction: 'Ask the house about its reserve policy.',
        structuredAnswer: { ...handoff, intent: 'general_information', category: 'unknown' } })
      .mockResolvedValue({ provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const first = await adapter.analyze('I have a painting', 'general-session');
    const answer = await adapter.analyze('What is an auction reserve?', 'general-session');
    expect(answer.ai.generalInformation).toBe(true);
    expect(answer.ai.summary).toContain('reserve');
    expect(answer.item).toEqual(first.item);
    expect(answer.nextQuestion).toBeNull();
    expect(answer.functionCall).toBeNull();
    await adapter.analyze('70x80 cm', 'general-session');
    expect(generate.mock.calls[2][0].prompt).not.toContain('What is an auction reserve?');
  });
  it('redirects an unrelated request without replacing saved facts or the active question', async () => {
    const generate = jest.fn()
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff })
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: false, error: null, structuredAnswer: handoff })
      .mockResolvedValue({ provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const first = await adapter.analyze('I have a painting', 'off-topic-session');
    const unrelated = await adapter.analyze('I want a coconut cake recipe', 'off-topic-session');
    expect(unrelated.ai.isRelevant).toBe(false);
    expect(unrelated.ai.summary).toContain('auction');
    expect(unrelated.nextQuestion).toBeNull();
    expect(unrelated.functionCall).toBeNull();
    expect(unrelated.item).toEqual(first.item);
    await adapter.analyze('60x80 cm', 'off-topic-session');
    expect(generate.mock.calls[2]?.[0].prompt).not.toContain('coconut');
  });
  it('does not store a valuation request as the missing condition during an outage', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()) } as never);
    const first = await adapter.analyze('I want to sell a blue ring size 8', 'valuation-not-condition');
    expect(first.requiredMissingFields).toContain('condition');
    const asked = await adapter.analyze('Please estimate value', 'valuation-not-condition');
    expect(asked.requiredMissingFields).toContain('condition');
    expect(asked.item.condition).not.toBe('Please estimate value');
  });
  it('normalizes an explicit ring from jewelry and does not consume an action as condition', async () => {
    const generate = jest.fn().mockResolvedValue({ provider: 'real', mode: 'real', isRelevant: true, error: null,
      structuredAnswer: { ...handoff, category: 'jewelry', item: { title: 'Blue ring', dimensions: { values: [{ label: 'size', value: 8, unit: 'size' }] } }, missingFacts: ['condition'] } });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const first = await adapter.analyze('I want to sell a blue ring size 8', 'ring-action');
    expect(first.item.category).toBe('rings');
    const action = await adapter.analyze('הצג מכירות קודמות של פריטים דומים', 'ring-action');
    expect(action.requiredMissingFields).toContain('condition');
    expect(action.nextQuestion?.field).toBe('condition');
    expect(action.item.condition).toBe(first.item.condition);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('does not execute unsolicited house recommendations returned by the model', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => ({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: handoff,
        functionCall: { functionToRun: 'rankSellerHouses', object: { category: 'paintings' } } })),
    } as never);
    expect((await adapter.analyze('Good condition')).functionCall).toBeNull();
  });
  it.each(['Find an auction house for my item', '\u05ea\u05de\u05e6\u05d0 \u05dc\u05d9 \u05d1\u05d9\u05ea \u05de\u05db\u05d9\u05e8\u05d5\u05ea', '\u05d1\u05d9\u05ea \u05de\u05db\u05d9\u05e8\u05d5\u05ea \u05de\u05d5\u05de\u05dc\u05e5'])('keeps mandatory intake questions ahead of a house request: %s', async input => {
    const generate = jest.fn().mockRejectedValue(new ServiceUnavailableException());
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('old manuscript', 'explicit-house');
    const result = await adapter.analyze(input, 'explicit-house');
    expect(result.functionCall?.functionToRun).toBeFalsy();
    expect(result.requiredMissingFields).toContain('dimensions');
    expect(result.nextQuestion?.field).toBe('dimensions');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each(['yes', 'I want previous sales', 'Do not recommend auction houses'])('does not replace another request with house ranking: %s', async input => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('old manuscript', 'no-house');
    expect((await adapter.analyze(input, 'no-house')).functionCall).toBeNull();
  });
  it('recognizes a Hebrew manuscript when AI returns unknown and retains it on later turns', async () => {
    const generate = jest.fn(async () => ({ provider: 'real', mode: 'real', isRelevant: true, error: null,
      structuredAnswer: { ...handoff, category: 'unknown', item: { title: 'Manuscript' } } }));
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const first = await adapter.analyze('\u05d9\u05e9 \u05dc\u05d9 \u05db\u05ea\u05d1 \u05d9\u05d3 \u05e2\u05ea\u05d9\u05e7 \u05dc\u05de\u05db\u05d9\u05e8\u05d4', 'manuscript');
    expect(first.item.category).toBe('rare_books');
    expect(first.requiredMissingFields).not.toContain('category');
    expect(first.nextQuestion?.field).toBe('dimensions');
    const next = await adapter.analyze('\u05db\u05ea\u05d1 \u05d9\u05d3 \u05e2\u05ea\u05d9\u05e7', 'manuscript');
    expect(next.item.category).toBe('rare_books');
    expect(next.nextQuestion?.field).toBe('dimensions');
    const action = await adapter.analyze('Which auction houses are recommended?', 'manuscript');
    expect(action.item.category).toBe('rare_books');
    expect(action.functionCall?.functionToRun).toBeFalsy();
    expect(action.requiredMissingFields).toContain('dimensions');
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('preserves a specific AI category rather than overriding it with local manuscript classification', async () => {
    const generate = jest.fn()
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, category: 'documents' } })
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, category: 'unknown' } });
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: generate,
    } as never);
    expect((await adapter.analyze('old manuscript', 'documents')).item.category).toBe('documents');
    expect((await adapter.analyze('width 80 cm', 'documents')).item.category).toBe('documents');
  });
  it('asks for the item category when it is unknown instead of silently stopping intake', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    const result = await adapter.analyze('I want to sell something', 'unknown-category');
    expect(result.requiredMissingFields).toContain('category');
    expect(result.nextQuestion?.field).toBe('category');
    const ring = await adapter.analyze('a ring size 8 in good condition', 'unknown-category');
    expect(ring.item.category).toBe('rings');
    expect(ring.requiredMissingFields).toEqual([]);
    expect(ring.nextQuestion).toBeNull();
  });
  it('stops optional questions after required details and allows a requested function', async () => {
    const generate = jest.fn()
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, item: { title: 'Painting', condition: 'Good',
          dimensions: { values: [{ label: 'width', value: 80, unit: 'cm' }] } },
          missingFacts: ['markings', 'signature', 'provenance'] } })
      .mockResolvedValueOnce({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, item: { title: 'Painting' }, missingFacts: ['provenance'] },
        functionCall: { functionToRun: 'listEvidence', object: { itemId: 'item-1' } } });
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    const ready = await adapter.analyze('Painting, width 80 cm, good condition', 'required-only');
    expect(ready.requiredMissingFields).toEqual([]);
    expect(ready.missingFields).toEqual(['marks', 'signatures', 'provenance']);
    expect(ready.nextQuestion).toBeNull();
    const action = await adapter.analyze('List evidence for item-1', 'required-only');
    expect(action.functionCall).toEqual({ functionToRun: 'listEvidence', object: { itemId: 'item-1' } });
    expect(action.requiredMissingFields).toEqual([]);
    expect(action.nextQuestion).toBeNull();
  });
  it('still asks for required condition when optional details are already supplied', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn(async () => ({ provider: 'real', mode: 'real', isRelevant: true, error: null,
        structuredAnswer: { ...handoff, item: { dimensions: { values: [{ label: 'width', value: 80, unit: 'cm' }] },
          markings: 'Stamp', signature: 'Signed', provenance: 'Family archive' }, missingFacts: [] } })),
    } as never);
    const result = await adapter.analyze('Painting');
    expect(result.requiredMissingFields).toEqual(['condition']);
    expect(result.nextQuestion?.field).toBe('condition');
  });
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
    draft.item.dimensions = { values: [{ label: 'width', value: 20, unit: 'cm' }] };
    draft.item.condition = 'Good';
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
      structuredAnswer: { ...handoff, category: 'rare_books', item: { title: 'Old manuscript', condition: 'Good', dimensions: { values: [{ label: 'width', value: 20, unit: 'cm' }] } } },
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
        provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: { ...handoff, item: { ...handoff.item, condition: 'Good', dimensions: { values: [{ label: 'width', value: 20, unit: 'cm' }] } } },
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
    expect(condition.nextQuestion).toBeNull();
    expect(condition.requiredMissingFields).toEqual([]);
    await adapter.analyze('no markings', 'full-session');
    const signed = await adapter.analyze('signature inside the ring, it says efrat', 'full-session');
    expect(signed.item.signatures).toContain('efrat');
    expect(signed.nextQuestion).toBeNull();
    const complete = await adapter.analyze('provenance: bought from a shop in 2019', 'full-session');
    expect(complete.item.provenance).toContain('bought from a shop in 2019');
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
    expect(next.nextQuestion).toBeNull();
    expect(next.requiredMissingFields).toEqual([]);
    const recommendation = await adapter.analyze('Which auction houses are recommended?', 'ring-session');
    expect(recommendation.functionCall?.functionToRun).toBe('rankSellerHouses');
    expect(recommendation.nextQuestion).toBeNull();
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
  it.each(['70*80 ס״מ', '70 × 80 cm', '70x80 ס"מ'])('accepts explicit dimensions during an outage: %s', async input => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('old manuscript', 'dimensions-session');
    const result = await adapter.analyze(input, 'dimensions-session');
    expect(result.item.dimensions.values).toEqual([
      { label: 'width', value: 70, unit: 'cm' },
      { label: 'height', value: 80, unit: 'cm' },
    ]);
    expect(result.nextQuestion?.field).toBe('condition');
    const next = await adapter.analyze('good', 'dimensions-session');
    expect(next.item.dimensions).toEqual(result.item.dimensions);
    expect(next.requiredMissingFields).not.toContain('dimensions');
  });
  it('asks only for the missing unit and accepts it on the next guided turn', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, {
      generateSellerExtract: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    } as never);
    await adapter.analyze('old manuscript', 'unit-session');
    const bare = await adapter.analyze('70*80', 'unit-session');
    expect(bare.item.dimensions.values).toEqual([]);
    expect(bare.nextQuestion?.en).toContain('unit');
    const complete = await adapter.analyze('ס״מ', 'unit-session');
    expect(complete.item.dimensions.values.map(value => value.unit)).toEqual(['cm', 'cm']);
    expect(complete.nextQuestion?.field).toBe('condition');
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
  it('uses the UI language when it is provided, even if the seller typed in another script', async () => {
    const generate = jest.fn(async () => ({
      provider: 'real', mode: 'real', isRelevant: true, error: null, structuredAnswer: handoff,
    }));
    const adapter = new SellerIntakeAiAdapter(intake, { generateSellerExtract: generate } as never);
    await adapter.analyze('\u05d9\u05e9 \u05dc\u05d9 \u05e6\u05d9\u05d5\u05e8', 'ui-language', 'en');
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });

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
