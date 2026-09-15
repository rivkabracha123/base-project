const { StaffOperationsController } = require('./staff-operations.controller');

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
    const controller = new StaffOperationsController(staffOperationsService);

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
    const controller = new StaffOperationsController(staffOperationsService);

    await expect(controller.getBuyerLeadDetail('buyer-lead-001')).resolves.toEqual(leadDetail);
    expect(staffOperationsService.getBuyerLeadDetail).toHaveBeenCalledWith('buyer-lead-001');
  });
});
