import { BadRequestException } from '@nestjs/common';
import { SellerWorkflowService } from './seller-workflow.service';

describe('SellerWorkflowService', () => {
  const profileId = 'profile-1';
  const leads = {
    draft: jest.fn(async (input) => ({ id: 'lead-1', ...input })),
    rankHouses: jest.fn(() => ({ recommendation: null, alternatives: [], excluded: [] })),
    attachRanking: jest.fn(async () => undefined),
    saveSellerChoice: jest.fn(async (_leadId, houseId) => ({ houseId })),
    list: jest.fn(async () => [{ id: 'lead-1', profileId }, { id: 'lead-other', profileId: 'other' }]),
  };
  const sellerIntakeAi = {
    analyze: jest.fn((input: string) => ({ input, status: 'draft' })),
  };
  const service = new SellerWorkflowService(sellerIntakeAi as never, leads as never);
  const callback = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches each function in Shilat\'s contract and returns the result through the callback', async () => {
    const calls = [
      [{ functionToRun: 'analyzeSellerIntake', object: { input: 'ציור שמן' } }, sellerIntakeAi.analyze],
      [{ functionToRun: 'createSellerLead', object: { profileId, contact: { preferredName: 'Seller', email: 'seller@example.test' }, serviceConsent: true } }, leads.draft],
      [{ functionToRun: 'rankHousesForLead', object: { leadId: 'lead-1', category: 'paintings', geography: 'Israel', preferredLanguage: 'he' } }, leads.rankHouses],
      [{ functionToRun: 'saveSellerHouseChoice', object: { leadId: 'lead-1', houseId: 'house-1' } }, leads.saveSellerChoice],
    ] as const;

    for (const [input] of calls) {
      const result = await service.execute({ profileId, structuredAnswer: input }, callback);
      expect(result.functionToRun).toBe(input.functionToRun);
      expect(callback).toHaveBeenLastCalledWith(result);
    }

    for (const [, handler] of calls) expect(handler).toHaveBeenCalled();
    expect(leads.attachRanking).toHaveBeenCalledWith('lead-1', expect.any(Object));
  });

  it('returns null without dispatch when no function is requested', async () => {
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: null, object: null },
    }, callback))
      .resolves.toEqual({ functionToRun: null, result: null });
  });

  it('rejects malformed and unsupported Shilat function responses', async () => {
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'saveSellerHouseChoice', object: {} } as never,
    }, callback))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'deleteEvidence', object: {} } as never,
    }, callback))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: null, object: {} } as never,
    }, callback))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects lead creation for a different profile', async () => {
    await expect(service.execute({
      profileId,
      structuredAnswer: {
        functionToRun: 'createSellerLead',
        object: { profileId: 'other-profile', contact: { preferredName: 'Seller', phone: '555' }, serviceConsent: true },
      },
    }, callback)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not create a seller lead without explicit service consent', async () => {
    await expect(service.execute({
      profileId,
      structuredAnswer: {
        functionToRun: 'createSellerLead',
        object: {
          profileId,
          contact: { preferredName: 'Seller', email: 'seller@example.test' },
          serviceConsent: false,
        },
      } as never,
    }, callback)).rejects.toBeInstanceOf(BadRequestException);
    expect(leads.draft).not.toHaveBeenCalled();
  });
});