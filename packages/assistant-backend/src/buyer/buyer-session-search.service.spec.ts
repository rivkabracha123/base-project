import { BuyerCriteriaService } from './buyer-criteria.service';
import { sampleAiExtractResponses } from './buyer-criteria.fixtures';
import { BuyerSessionSearchService } from './buyer-session-search.service';

describe('BuyerSessionSearchService', () => {
  it('preserves insufficient criteria instead of claiming the search found no matches', async () => {
    const criteria = new BuyerCriteriaService();
    const opened = criteria.startCriteriaSessionFromAiResponse(sampleAiExtractResponses.paintingEn());
    const presentation = { presentSearchResults: jest.fn().mockResolvedValue({ groups: [], outcome: {
      kind: 'insufficient-criteria', searchRequest: { language: 'en',
        criteria: criteria.getCriteriaForSession(opened.sessionId), hardConstraints: [] },
    } }) };
    try {
      const service = new BuyerSessionSearchService(presentation);
      expect(await service.searchForSession(opened.sessionId)).toEqual({
        kind: 'insufficient-criteria', message: 'What items would you like to search for?',
      });
    } finally {
      criteria.resetSessionsForTests();
    }
  });
});
