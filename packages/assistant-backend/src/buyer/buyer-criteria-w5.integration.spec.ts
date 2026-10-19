import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses, structuredAiExtractSamples } from './buyer-criteria.fixtures';

describe('Buyer criteria W5 integration', () => {
  const service = new BuyerCriteriaService();

  beforeEach(() => {
    service.resetSessionsForTests();
  });

  it('extract → skip with no pending question → review keeps the criteria and lists nothing as skipped', () => {
    const first = service.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());

    // Optional facts are no longer asked once the category is known, so a skip has nothing to mark.
    service.continueCriteriaSessionFromChat({
      id: 'buyer-skip-creator',
      sessionId: first.sessionId,
      speaker: 'buyer',
      skipped: true,
    });

    const review = service.getCriteriaReview(first.sessionId);
    expect(review.summary).toContain('Category: painting');
    expect(review.summary).not.toContain('Skipped:');
    expect(review.criteria.categories).toEqual(['painting']);
  });

  it('starts guided fallback when AI extract is irrelevant', () => {
    const first = service.startCriteriaSessionFromAiResponse(structuredAiExtractSamples.irrelevantHe());
    const session = service.getSessionResponse(first.sessionId);

    expect(session.conversation.notes).toContain('guided_fallback');
    expect(first.text.length).toBeGreaterThan(0);
  });
});
