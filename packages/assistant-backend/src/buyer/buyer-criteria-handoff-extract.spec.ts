import { extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { week3P4Fixtures, week4P4HandoffFixtures } from './buyer-criteria.test-helpers';

describe('Criteria from handoff fixture', () => {
  it('maps a validated fixture response into BuyerCriteriaResponse', () => {
    const handoffResponse = week3P4Fixtures.paintingEn();

    expect(handoffResponse.mode).toBe('fixture');
    expect(handoffResponse.provider).toBe('fixture');

    const response = extractBuyerCriteriaFromFixture(handoffResponse);

    expect(response.criteria.categories).toEqual(['painting']);
    expect(response.criteria.language).toBe('en');
    expect(response.conversation.notes).toContain(handoffResponse.summary);
  });

  it('detects Hebrew from fixture content', () => {
    const response = extractBuyerCriteriaFromFixture(week3P4Fixtures.paintingHe());

    expect(response.criteria.language).toBe('he');
    expect(response.conversation.nextQuestion).toBe('יש אמן או יוצר מסוים?');
  });

  it('prefers Shilat structuredAnswer over content parsing', () => {
    const handoffResponse = week4P4HandoffFixtures.blueRingHe();
    const response = extractBuyerCriteriaFromFixture(handoffResponse);

    expect(response.criteria.categories).toEqual(['טבעות']);
    expect(response.criteria.keywords).toEqual(['blue']);
    expect(response.criteria.language).toBe('he');
    expect(response.conversation.notes).toContain(handoffResponse.structuredAnswer!.intent);
    expect(response.conversation.missing).toContain('budget');
  });

  it('rejects isRelevant=false before extract (handled by Tamar, guarded in criteria service)', () => {
    expect(() => extractBuyerCriteriaFromFixture(week4P4HandoffFixtures.irrelevantHe())).toThrow(
      'השאלה אינה קשורה לקנייה או למכירה',
    );
  });
});
