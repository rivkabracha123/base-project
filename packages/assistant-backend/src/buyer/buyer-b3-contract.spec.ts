import { criteriaToSearchRequest } from './criteria-to-search-request';
import { extractBuyerCriteriaFromFixture, processCriteriaTurn } from './buyer-criteria';
import { week3P4Fixtures, week3TurnFixtures } from './buyer-criteria.test-helpers';

describe('B2 → B3 criteria contract', () => {
  it('passes clarified criteria into B3 search request shape', () => {
    const extracted = extractBuyerCriteriaFromFixture(week3P4Fixtures.paintingEn());
    const response = processCriteriaTurn({
      criteria: extracted.criteria,
      conversation: extracted.conversation,
      action: 'answer',
      message: 'Monet',
    });

    expect(criteriaToSearchRequest(response.criteria, response.criteria.language)).toEqual({
      query: 'Monet blue',
      language: 'en',
    });
    expect(response.conversation.missing).toEqual(['location']);
    expect(response.conversation.nextQuestion).toBe('Is there a place or origin that matters?');
  });

  it('uses the same turn fixtures as manual verification', () => {
    const response = processCriteriaTurn(week3TurnFixtures.answerMonet());

    expect(criteriaToSearchRequest(response.criteria, 'en')).toEqual({
      query: 'Monet blue',
      language: 'en',
    });
  });
});
