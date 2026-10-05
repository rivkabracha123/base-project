import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses, structuredAiExtractSamples } from './buyer-criteria.fixtures';

describe('Buyer criteria W5 integration', () => {
  const service = new BuyerCriteriaService();
  const date = '2026-10-05T10:00:00.000Z';

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('extract → skip optional fact → review summary lists skipped fields', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());

    service.continueCriteriaSessionFromChat({
      id: 'buyer-skip-creator',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: true,
      date,
    });

    const review = service.getCriteriaReview(first.sessionId);
    expect(review.summary).toContain('Skipped: creator');
    expect(review.criteria.categories).toEqual(['painting']);
  });

  it('starts guided fallback when AI extract is irrelevant', () => {
    const first = service.startCriteriaSessionFromAiResponse(structuredAiExtractSamples.irrelevantHe());
    const session = service.getSessionResponse(first.sessionId);

    expect(session.conversation.notes).toContain('guided_fallback');
    expect(first.text.length).toBeGreaterThan(0);
  });
});
