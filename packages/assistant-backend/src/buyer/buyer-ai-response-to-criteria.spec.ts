import { parseCriteriaFromAiResponse } from './buyer-criteria';
import { sampleAiExtractResponses, structuredAiExtractSamples } from './buyer-criteria.fixtures';

describe('Criteria from AI extract response', () => {
  it('maps a validated fixture response into BuyerCriteriaResponse', () => {
    const aiResponse = sampleAiExtractResponses.paintingEn();

    expect(aiResponse.mode).toBe('fixture');
    expect(aiResponse.provider).toBe('fixture');

    const response = parseCriteriaFromAiResponse(aiResponse);

    expect(response.criteria.categories).toEqual(['painting']);
    expect(response.criteria.language).toBe('en');
    expect(response.conversation.notes).toContain(aiResponse.summary);
  });

  it('detects Hebrew from fixture content', () => {
    const response = parseCriteriaFromAiResponse(sampleAiExtractResponses.paintingHe());

    expect(response.criteria.language).toBe('he');
    expect(response.conversation.nextQuestion).toBe('יש אמן או יוצר מסוים?');
  });

  it('prefers structured AI fields over free-text content', () => {
    const aiResponse = structuredAiExtractSamples.blueRingHe();
    const response = parseCriteriaFromAiResponse(aiResponse);

    expect(response.criteria.categories).toEqual(['טבעות']);
    expect(response.criteria.keywords).toEqual(['blue']);
    expect(response.criteria.language).toBe('he');
    expect(response.conversation.notes).toContain(aiResponse.structuredAnswer!.intent);
    expect(response.conversation.missing).toContain('budget');
  });

  it('rejects irrelevant AI extract before parsing criteria', () => {
    expect(() => parseCriteriaFromAiResponse(structuredAiExtractSamples.irrelevantHe())).toThrow(
      'השאלה אינה קשורה לקנייה או למכירה',
    );
  });
});
