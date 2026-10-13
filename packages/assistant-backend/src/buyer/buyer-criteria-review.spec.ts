import { emptyBuyerCriteria } from './buyer-criteria';
import { formatBuyerCriteriaReviewSummary } from './buyer-criteria-review';

describe('formatBuyerCriteriaReviewSummary', () => {
  it('lists confirmed criteria and skipped optional facts', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['painting'];
    criteria.price = { min: 1000, max: 5000, currency: 'USD' };

    const summary = formatBuyerCriteriaReviewSummary(criteria, {
      skipped: ['creator'],
      missing: [],
      nextQuestion: 'Ready',
      notes: [],
    });

    expect(summary).toContain('Category: painting');
    expect(summary).toContain('Budget: 1000–5000');
    expect(summary).toContain('Skipped: creator');
  });
});
