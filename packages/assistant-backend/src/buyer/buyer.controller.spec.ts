import { BuyerController } from './buyer.controller';
import { extractBuyerCriteriaFromFixture } from './buyer-criteria';
import { week3P4Fixtures, week3TurnFixtures } from './buyer-criteria.test-helpers';

describe('BuyerController', () => {
  const criteriaAfterExtract = extractBuyerCriteriaFromFixture(week3P4Fixtures.paintingEn());
  const turnAnswerRequest = week3TurnFixtures.answerMonet();
  const turnSkipRequest = week3TurnFixtures.skipLocation();

  it('extractFromFixture delegates to the service', () => {
    const service = { extractFromFixture: jest.fn().mockReturnValue(criteriaAfterExtract) };
    const controller = new BuyerController(service as never);

    const result = controller.extractFromFixture(week3P4Fixtures.paintingEn());

    expect(result).toBe(criteriaAfterExtract);
    expect(service.extractFromFixture).toHaveBeenCalledWith(week3P4Fixtures.paintingEn());
  });

  it('processCriteriaTurn delegates answer turns to the service', () => {
    const criteriaAfterTurn = {
      ...criteriaAfterExtract,
      criteria: { ...criteriaAfterExtract.criteria, creators: ['Monet'] },
      conversation: { ...criteriaAfterExtract.conversation, missing: ['location'] },
    };
    const service = { processTurn: jest.fn().mockReturnValue(criteriaAfterTurn) };
    const controller = new BuyerController(service as never);

    const result = controller.processCriteriaTurn(turnAnswerRequest);

    expect(result).toBe(criteriaAfterTurn);
    expect(service.processTurn).toHaveBeenCalledWith(turnAnswerRequest);
  });

  it('processCriteriaTurn delegates skip turns to the service', () => {
    const criteriaAfterSkip = {
      ...turnSkipRequest,
      conversation: {
        ...turnSkipRequest.conversation,
        skipped: ['location'],
        missing: [],
      },
    };
    const service = { processTurn: jest.fn().mockReturnValue(criteriaAfterSkip) };
    const controller = new BuyerController(service as never);

    const result = controller.processCriteriaTurn(turnSkipRequest);

    expect(result).toBe(criteriaAfterSkip);
    expect(service.processTurn).toHaveBeenCalledWith(turnSkipRequest);
  });
});
