import { extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { week3P4Fixtures, week4P4HandoffFixtures } from './buyer-criteria.test-helpers';

describe('Criteria from P4 fixture', () => {
  it('maps a validated P4 fixture response into BuyerCriteriaResponse', () => {
    const p4Response = week3P4Fixtures.paintingEn();

    expect(p4Response.mode).toBe('fixture');
    expect(p4Response.provider).toBe('fixture');

    const response = extractBuyerCriteriaFromFixture(p4Response);

    expect(response.criteria.categories).toEqual(['painting']);
    expect(response.criteria.language).toBe('en');
    expect(response.conversation.notes).toContain(p4Response.summary);
  });

  it('detects Hebrew from P4 content', () => {
    const response = extractBuyerCriteriaFromFixture(week3P4Fixtures.paintingHe());

    expect(response.criteria.language).toBe('he');
    expect(response.conversation.nextQuestion).toBe('יש אמן או יוצר מסוים?');
  });

  it('prefers Shilat structuredAnswer over content parsing', () => {
    const p4Response = week4P4HandoffFixtures.blueRingHe();
    const response = extractBuyerCriteriaFromFixture(p4Response);

    expect(response.criteria.categories).toEqual(['טבעות']);
    expect(response.criteria.keywords).toEqual(['blue']);
    expect(response.criteria.language).toBe('he');
    expect(response.conversation.notes).toContain(p4Response.structuredAnswer!.intent);
    expect(response.conversation.missing).toContain('budget');
  });

  it('rejects isRelevant=false before extract (handled by B1, guarded in B2)', () => {
    expect(() => extractBuyerCriteriaFromFixture(week4P4HandoffFixtures.irrelevantHe())).toThrow(
      'השאלה אינה קשורה לקנייה או למכירה',
    );
  });
});
