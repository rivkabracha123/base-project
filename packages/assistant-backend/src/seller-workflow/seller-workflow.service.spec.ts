import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SellerWorkflowService } from './seller-workflow.service';

describe('SellerWorkflowService', () => {
  const profileId = 'profile-1';
  const ownedLead = {
    id: 'lead-1',
    profileId,
    contact: { preferredName: 'Private Seller', email: 'private@example.test' },
    recommendation: { recommendation: { house: { name: 'Example House' } } },
    sellerChoice: { houseName: 'Chosen House' },
    catalogDraft: { he: 'פריט', en: 'Item' },
    item: { id: 'item-1', category: 'paintings', title: 'Item' },
    evidence: [{ id: 'evidence-1', type: 'seller_statement' }],
    valuation: { status: 'supported' },
    status: 'draft',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const leads = {
    draft: jest.fn(async (input) => ({ id: 'lead-1', ...input })),
    rankHouses: jest.fn(() => ({ recommendation: null, alternatives: [], excluded: [] })),
    attachRanking: jest.fn(async () => undefined),
    saveSellerChoice: jest.fn(async (_leadId, houseId) => ({ houseId })),
    submitFinal: jest.fn(async (leadId, payload) => ({ id: leadId, ...payload })),
    list: jest.fn(async () => [ownedLead, { id: 'lead-other', profileId: 'other' }]),
  };
  const evidence = [{ fileId: 'file-1', profileId, itemId: 'item-1', mimeType: 'image/jpeg', previewUri: '/preview', downloadUri: '/download' }];
  const uploads = {
    listEvidence: jest.fn(async () => evidence),
    reorderEvidence: jest.fn(async (_profileId: string, fileIds: string[]) => fileIds.map((fileId: string) => evidence.find((entry) => entry.fileId === fileId))),
    deleteEvidence: jest.fn(async () => undefined),
  };
  const sellerIntakeAi = {
    analyze: jest.fn((input: string) => ({ input, status: 'draft' })),
  };
  const service = new SellerWorkflowService(sellerIntakeAi as never, leads as never, uploads as never);
  const callback = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies the saved catalog and previews an enquiry without creating or submitting a lead', async () => {
    const item = { id: 'saved-item', category: 'rare_books', title: 'Manuscript', dimensions: { values: [{ label: 'width', value: 20, unit: 'cm' }] }, condition: 'Good', catalogDraft: { he: 'מקור לא אושר', en: 'Origin unconfirmed' } };
    const draft = { item, evidence: [] };
    const drafts = { getDraft: jest.fn().mockResolvedValue({ draft }) };
    const connected = new SellerWorkflowService(sellerIntakeAi as never, leads as never, uploads as never, drafts as never);
    expect((await connected.execute({ profileId, structuredAnswer: { functionToRun: 'getSellerCatalogDraft', object: { sessionId: 's1' } } })).result)
      .toEqual({ title: 'Manuscript', ...item.catalogDraft });
    expect((await connected.execute({ profileId, structuredAnswer: { functionToRun: 'getSellerEnquiryPreview', object: { sessionId: 's1' } } })).result)
      .toMatchObject({ draft });
    expect(drafts.getDraft).toHaveBeenCalledWith(profileId, 's1');
    expect(leads.draft).not.toHaveBeenCalled();
    expect(leads.submitFinal).not.toHaveBeenCalled();
  });

  it('blocks catalog and enquiry previews when mandatory facts are missing', async () => {
    const drafts = { getDraft: jest.fn().mockResolvedValue({ draft: { item: { category: 'rare_books', dimensions: { values: [] }, condition: 'Good' } } }) };
    const connected = new SellerWorkflowService(sellerIntakeAi as never, leads as never, uploads as never, drafts as never);
    await expect(connected.execute({ profileId, structuredAnswer: { functionToRun: 'getSellerCatalogDraft', object: { sessionId: 's1' } } })).rejects.toThrow('require category');
    expect(leads.rankHouses).not.toHaveBeenCalled();
  });

  it('calculates valuation using the current profile saved draft rather than supplied item data', async () => {
    const item = { id: 'saved-item', category: 'rings', dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] }, condition: 'Good' };
    const drafts = { getDraft: jest.fn().mockResolvedValue({ version: 3, draft: { item } }) };
    const valuation = { calculateFromItem: jest.fn().mockResolvedValue({ status: 'refusal', reason: 'insufficient_comparable_sales' }) };
    const connected = new SellerWorkflowService(sellerIntakeAi as never, leads as never, uploads as never, drafts as never, valuation as never);
    const result = await connected.execute({ profileId, structuredAnswer: { functionToRun: 'calculateSellerValuation', object: { sessionId: 'session-1', itemId: 'untrusted-item' } } });
    expect(drafts.getDraft).toHaveBeenCalledWith(profileId, 'session-1');
    expect(valuation.calculateFromItem).toHaveBeenCalledWith({ itemId: 'saved-item', itemVersion: 'v3', item });
    expect(result.result).toMatchObject({ status: 'refusal' });
  });

  it('does not calculate valuation for an incomplete or inaccessible draft', async () => {
    const drafts = { getDraft: jest.fn().mockResolvedValue({ version: 1, draft: { item: { category: 'rings', dimensions: { values: [] }, condition: 'Good' } } }) };
    const valuation = { calculateFromItem: jest.fn() };
    const connected = new SellerWorkflowService(sellerIntakeAi as never, leads as never, uploads as never, drafts as never, valuation as never);
    const request = { profileId, structuredAnswer: { functionToRun: 'calculateSellerValuation' as const, object: { sessionId: 'session-1' } } };
    await expect(connected.execute(request)).rejects.toThrow(BadRequestException);
    drafts.getDraft.mockRejectedValueOnce(new NotFoundException());
    await expect(connected.execute(request)).rejects.toThrow(NotFoundException);
    expect(valuation.calculateFromItem).not.toHaveBeenCalled();
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
    expect(leads.attachRanking).toHaveBeenCalledWith({ profileId }, 'lead-1', expect.any(Object));
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

  it('dispatches createSellerLeadDraft and rankSellerHouses', async () => {
    const draft = await service.execute({
      profileId,
      structuredAnswer: {
        functionToRun: 'createSellerLeadDraft',
        object: { profileId, contact: { preferredName: 'Seller', phone: '555' }, serviceConsent: true },
      },
    });
    const ranking = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'rankSellerHouses', object: { category: 'paintings', geography: 'Israel' } },
    });

    expect(draft.functionToRun).toBe('createSellerLeadDraft');
    expect(leads.draft).toHaveBeenCalledWith({ profileId }, {
      profileId,
      contact: { preferredName: 'Seller', phone: '555' },
      serviceConsent: true,
    });
    expect(ranking.functionToRun).toBe('rankSellerHouses');
    expect(leads.rankHouses).toHaveBeenCalledWith({ category: 'paintings', geography: 'Israel' });
  });

  it('ranks and stores, chooses, and submits only an owned seller lead', async () => {
    await service.execute({
      profileId,
      structuredAnswer: {
        functionToRun: 'rankAndStoreSellerHouses',
        object: { leadId: 'lead-1', category: 'paintings' },
      },
    });
    await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'chooseSellerHouse', object: { leadId: 'lead-1', houseId: 'house-1' } },
    });
    await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'submitFinalSellerLead', object: { leadId: 'lead-1', payload: {
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
        item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
        evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
        valuation: {
          status: 'supported', reportId: 'valuation-001', comparableCount: 1,
          confidence: { level: 'low', explanation: 'Pending expert review.' },
          limitations: ['Historical data only.'], comparables: [{ id: 'comp-001', source: { label: 'fixture', url: null } }],
          excludedComparables: [], valuationRange: { min: 800, max: 1200, currency: 'USD' },
        },
      } } },
    });

    expect(leads.attachRanking).toHaveBeenCalledWith({ profileId }, 'lead-1', expect.any(Object));
    expect(leads.saveSellerChoice).toHaveBeenCalledWith({ profileId }, 'lead-1', 'house-1');
    expect(leads.submitFinal).toHaveBeenCalledWith('lead-1', expect.objectContaining({ item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] } }));
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'chooseSellerHouse', object: { leadId: 'lead-other', houseId: 'house-1' } },
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists and returns only safe details for the current profile', async () => {
    const list = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'listSellerLeads', object: {} },
    });
    const detail = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'getSellerLead', object: { leadId: 'lead-1' } },
    });

    expect(list.result).toEqual([expect.objectContaining({ leadId: 'lead-1' })]);
    expect(JSON.stringify(detail.result)).not.toContain('private@example.test');
    expect(detail.result).toEqual(expect.objectContaining({ leadId: 'lead-1', item: ownedLead.item }));
    await expect(service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'getSellerLead', object: { leadId: 'lead-other' } },
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('dispatches evidence list, upload handoff, file lookup, reorder, and delete', async () => {
    const list = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'listEvidence', object: { itemId: 'item-1' } },
    });
    const upload = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'uploadEvidence', object: { itemId: 'item-1' } },
    });
    const file = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'getEvidenceFile', object: { fileId: 'file-1' } },
    });
    await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'reorderEvidence', object: { fileIds: ['file-1'] } },
    });
    const deleted = await service.execute({
      profileId,
      structuredAnswer: { functionToRun: 'deleteEvidence', object: { fileId: 'file-1' } },
    });

    expect(list.result).toEqual(evidence);
    expect(uploads.listEvidence).toHaveBeenCalledWith(profileId, 'item-1');
    expect(upload.result).toMatchObject({ status: 'client_action_required', method: 'POST', fieldName: 'files' });
    expect(file.result).toEqual({ fileId: 'file-1', previewUri: '/preview', downloadUri: '/download', mimeType: 'image/jpeg' });
    expect(uploads.reorderEvidence).toHaveBeenCalledWith(profileId, ['file-1']);
    expect(uploads.deleteEvidence).toHaveBeenCalledWith(profileId, 'file-1');
    expect(deleted.result).toEqual({ success: true });
  });
});
