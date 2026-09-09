const { StaffOperationsService } = require('./staff-operations.service');

describe('StaffOperationsService', () => {
  it('returns newest synthetic leads using only dashboard-safe fields', async () => {
    const newestLead = {
      id: 'lead-newest',
      type: 'buyer',
      clientName: 'Synthetic Buyer',
      status: 'new',
      requestDetails: 'Looking for a rare manuscript.',
      createdAt: new Date('2026-08-31T11:15:00.000Z'),
      payload: { contact: { email: 'do-not-expose@example.test' } },
    };
    const repository = { find: jest.fn().mockResolvedValue([newestLead]) };
    const service = new StaffOperationsService(repository);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'lead-newest', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
        requestDetails: 'Looking for a rare manuscript.', createdAt: new Date('2026-08-31T11:15:00.000Z'),
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('maps a results outcome from a dashboard buyer lead source', async () => {
    const staffLead = {
      id: 'buyer-lead-001',
      type: 'buyer',
      status: 'new',
    };
    const buyerLeadDashboardSource = {
      getBuyerLead: jest.fn().mockResolvedValue({
        outcome: {
          kind: 'results',
          searchRequest: {
            criteria: { category: 'rare_hebrew_manuscript' },
            hardConstraints: [
              { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
              { field: 'format', operator: 'equals', value: 'original', reason: 'buyer request' },
            ],
          },
          groupedItems: {
            current: [{ id: '121421' }],
            historical: [{ id: '121424' }],
          },
        },
        contact: {
          preferredName: 'Synthetic Buyer',
          email: 'buyer.demo@example.test',
          phone: null,
          followUpStatus: 'ready',
          serviceConsent: { granted: true, policyVersion: 'v1.0' },
        },
      }),
    };
    const repository = { findOneBy: jest.fn().mockResolvedValue(staffLead) };
    const service = new StaffOperationsService(repository, buyerLeadDashboardSource);

    await expect(service.getBuyerLeadDetail('buyer-lead-001')).resolves.toEqual({
      id: 'buyer-lead-001',
      type: 'buyer',
      status: 'new',
      criteria: { category: 'rare_hebrew_manuscript' },
      hardConstraints: [
        { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
        { field: 'format', operator: 'equals', value: 'original', reason: 'buyer request' },
      ],
      results: [
        { id: '121421', group: 'current' },
        { id: '121424', group: 'historical' },
      ],
      unmatchedDemand: null,
      contact: {
        preferredName: 'Synthetic Buyer',
        email: 'buyer.demo@example.test',
        phone: null,
        followUpStatus: 'ready',
        serviceConsent: { granted: true, policyVersion: 'v1.0' },
      },
    });
    expect(buyerLeadDashboardSource.getBuyerLead).toHaveBeenCalledWith('buyer-lead-001');
  });

  it('keeps unmatched demand and withholds contact without service consent', async () => {
    const buyerLeadDashboardSource = {
      getBuyerLead: jest.fn().mockResolvedValue({
        outcome: {
          kind: 'unmatched',
          view: {
            unmatchedDemand: {
              reason: 'no_results',
              searchRequest: {
                criteria: {
                  category: 'rare_hebrew_manuscript',
                  format: 'original',
                  budget: { max: 15000, currency: 'USD' },
                },
                hardConstraints: [
                  { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
                  { field: 'format', operator: 'equals', value: 'original', reason: 'buyer request' },
                ],
              },
            },
          },
        },
        contact: {
          preferredName: 'Anonymous Buyer',
          email: 'withhold.demo@example.test',
          phone: '+972-50-0000000',
          followUpStatus: 'consent_required',
          serviceConsent: { granted: false },
        },
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'buyer-lead-002',
        type: 'buyer',
        status: 'new',
        createdAt: new Date('2026-09-06T10:00:00.000Z'),
      }),
    };
    const service = new StaffOperationsService(repository, buyerLeadDashboardSource);

    const result = await service.getBuyerLeadDetail('buyer-lead-002');

    expect(result.results).toEqual([]);
    expect(result.unmatchedDemand).toEqual({
      reason: 'no_results',
      originalCriteria: {
        category: 'rare_hebrew_manuscript',
        format: 'original',
        budget: { max: 15000, currency: 'USD' },
      },
    });
    expect(result.hardConstraints).toEqual([
      { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
      { field: 'format', operator: 'equals', value: 'original', reason: 'buyer request' },
    ]);
    expect(result.contact).toEqual({
      preferredName: 'Anonymous Buyer',
      email: null,
      phone: null,
      followUpStatus: 'consent_required',
      serviceConsent: { granted: false },
    });
  });

  it('does not query the buyer source for an unknown staff lead', async () => {
    const buyerLeadDashboardSource = { getBuyerLead: jest.fn() };
    const repository = { findOneBy: jest.fn().mockResolvedValue(undefined) };
    const service = new StaffOperationsService(repository, buyerLeadDashboardSource);

    await expect(service.getBuyerLeadDetail('unknown-lead')).rejects.toThrow('Buyer lead not found');
    expect(buyerLeadDashboardSource.getBuyerLead).not.toHaveBeenCalled();
  });
});
