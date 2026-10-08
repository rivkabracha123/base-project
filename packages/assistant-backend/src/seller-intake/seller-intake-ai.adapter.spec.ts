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
    const adapter = new SellerIntakeAiAdapter(intake, { generate } as never);
    const baseline = intake.analyze('oil painting 60x80');
    const result = await adapter.analyze('oil painting 60x80', undefined);

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ role: 'seller', language: 'en' }));
    expect(result.structuredAnswer).toEqual(handoff);
    expect(result.ai.aiMissingFields).toEqual(['marks', 'signatures']);
    expect(result.missingFields).toEqual(baseline.missingFields);
    expect(result.confirmedFacts).toEqual(baseline.confirmedFacts);
  });
//test alls back on failure
  it('degrades to the intake result when AiService fails', async () => {
    const adapter = new SellerIntakeAiAdapter(intake, { generate: jest.fn(async () => { throw new Error('boom'); }) } as never);
    const result = await adapter.analyze('ציור שמן');

    expect(result.structuredAnswer).toBeNull();
    expect(result.ai.error).toBe('unavailable');
    expect(result.missingFields.length).toBeGreaterThan(0);
  });
});
