import { StaffOperationsController } from './staff-operations.controller';

describe('StaffOperationsController', () => {
  it('returns the privacy-limited lead list supplied by its domain service', async () => {
    const leads = [
      {
        id: 'buyer-lead',
        type: 'buyer',
        clientName: 'Synthetic Buyer',
        status: 'new',
        requestDetails: 'Looking for a rare manuscript.',
        createdAt: new Date('2026-08-31T11:15:00.000Z'),
      },
    ];
    const staffOperationsService = { findAll: jest.fn().mockResolvedValue(leads) };
    const controller = new StaffOperationsController(staffOperationsService as never);

    await expect(controller.getLeads()).resolves.toEqual(leads);
    expect(staffOperationsService.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns a privacy-limited buyer lead detail by lead ID', async () => {
    const leadDetail = {
      id: 'buyer-lead-001',
      type: 'buyer',
      status: 'new',
      criteria: { category: 'rare_hebrew_manuscript' },
      hardConstraints: [],
      results: [],
      unmatchedDemand: {
        reason: 'no_results',
        originalCriteria: { category: 'rare_hebrew_manuscript' },
      },
      contact: {
        preferredName: 'Anonymous Buyer',
        email: null,
        phone: null,
        followUpStatus: 'consent_required',
        serviceConsent: { granted: false },
      },
    };
    const staffOperationsService = {
      getBuyerLeadDetail: jest.fn().mockResolvedValue(leadDetail),
    };
    const controller = new StaffOperationsController(staffOperationsService as never);

    await expect(controller.getBuyerLeadDetail('buyer-lead-001')).resolves.toEqual(leadDetail);
    expect(staffOperationsService.getBuyerLeadDetail).toHaveBeenCalledWith('buyer-lead-001');
  });

  it('returns a privacy-limited seller lead detail through the shared lead route', async () => {
    const leadDetail = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      status: 'submitted',
      item: { title: 'Synthetic silver menorah' },
      evidence: [{ id: 'evidence-001', type: 'image' }],
      comparables: [],
      valuation: null,
      recommendation: null,
      alternatives: [],
      sellerChoice: null,
      catalogDraft: null,
      contact: {
        preferredName: 'Synthetic Seller',
        email: null,
        phone: null,
        serviceConsentGranted: false,
      },
      history: [],
    };
    const staffOperationsService = {
      getLeadDetail: jest.fn().mockResolvedValue(leadDetail),
    };
    const controller = new StaffOperationsController(staffOperationsService as never);

    await expect(controller.getLeadDetail('11111111-1111-4111-8111-111111111111')).resolves.toEqual(leadDetail);
    expect(staffOperationsService.getLeadDetail).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('forwards a pipeline update without exposing the stored lead payload', async () => {
    const result = { status: 'reviewing', nextAction: 'Review the lots.', statusHistory: [], activityNotes: [] };
    const staffOperationsService = { updatePipeline: jest.fn().mockResolvedValue(result) };
    const controller = new StaffOperationsController(staffOperationsService as never);

    await expect(controller.updatePipeline('buyer-lead-001', { status: 'reviewing', note: 'Opened for review.' })).resolves.toEqual(result);
    expect(staffOperationsService.updatePipeline).toHaveBeenCalledWith('buyer-lead-001', { status: 'reviewing', note: 'Opened for review.' });
  });
});
