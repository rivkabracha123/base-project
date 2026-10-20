import { StaffOperationsService } from './staff-operations.service';

type StaffOperationsServiceArgs = ConstructorParameters<typeof StaffOperationsService>;

function createService(repository: unknown, buyerLeadDashboardSource: unknown = {}, sellerLeadDashboardSource?: unknown) {
  return new StaffOperationsService(
    repository as StaffOperationsServiceArgs[0],
    buyerLeadDashboardSource as StaffOperationsServiceArgs[1],
    sellerLeadDashboardSource as StaffOperationsServiceArgs[2],
  );
}

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
    const service = createService(repository);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'lead-newest', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
        requestDetails: 'Looking for a rare manuscript.', createdAt: new Date('2026-08-31T11:15:00.000Z'),
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('includes the safe lead category from the stored dashboard payload', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{
        id: 'lead-category', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
        requestDetails: 'Looking for a rare manuscript.', createdAt: new Date('2026-08-31T11:15:00.000Z'),
        payload: { category: 'rare_books', contact: { email: 'do-not-expose@example.test' } },
      }]),
    };
    const service = createService(repository);

    await expect(service.findAll()).resolves.toEqual([expect.objectContaining({ category: 'rare_books' })]);
  });

  it('keeps the category available for an older synthetic demonstration lead', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{
        id: 'buyer-lead-001', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
        requestDetails: 'Looking for a rare manuscript.', createdAt: new Date('2026-08-31T11:15:00.000Z'), payload: {},
      }]),
    };
    const service = createService(repository);

    await expect(service.findAll()).resolves.toEqual([expect.objectContaining({ category: 'rare_hebrew_manuscript' })]);
  });

  it('persists an approved status change, next action, and short activity note', async () => {
    const lead = {
      id: 'pipeline-lead', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
      requestDetails: 'Looking for a manuscript.', createdAt: new Date('2026-09-01T10:00:00.000Z'), payload: {},
    };
    const repository = { findOneBy: jest.fn().mockResolvedValue(lead), save: jest.fn().mockImplementation(async (value) => value) };
    const service = createService(repository);

    const result = await service.updatePipeline('pipeline-lead', {
      status: 'reviewing', nextAction: 'Review the matching lots.', note: 'Opened the request for review.',
    });

    expect(result).toEqual(expect.objectContaining({ status: 'reviewing', nextAction: 'Review the matching lots.' }));
    expect(result.statusHistory).toEqual(expect.arrayContaining([expect.objectContaining({ from: 'new', to: 'reviewing' })]));
    expect(result.activityNotes).toEqual([expect.objectContaining({ text: 'Opened the request for review.' })]);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'reviewing',
      payload: expect.objectContaining({ staffPipeline: expect.any(Object) }),
    }));
  });

  it('retains the complete ordered status transition history across updates', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T09:00:00.000Z'));
    let storedLead = {
      id: 'pipeline-history-lead', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
      requestDetails: 'Looking for a manuscript.', createdAt: new Date('2026-09-01T10:00:00.000Z'), payload: {},
    };
    const repository = {
      findOneBy: jest.fn().mockImplementation(async () => storedLead),
      save: jest.fn().mockImplementation(async (lead) => {
        storedLead = lead;
        return lead;
      }),
    };
    const service = createService(repository);

    try {
      await service.updatePipeline('pipeline-history-lead', { status: 'reviewing' });
      jest.setSystemTime(new Date('2026-10-18T09:05:00.000Z'));
      const result = await service.updatePipeline('pipeline-history-lead', { status: 'contacted' });

      expect(result.statusHistory).toEqual([
        { at: '2026-09-01T10:00:00.000Z', from: null, to: 'new' },
        { at: '2026-10-18T09:00:00.000Z', from: 'new', to: 'reviewing' },
        { at: '2026-10-18T09:05:00.000Z', from: 'reviewing', to: 'contacted' },
      ]);
      expect(repository.save).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not persist a skipped pipeline status', async () => {
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'pipeline-lead', type: 'buyer', status: 'new', createdAt: new Date(), payload: {},
      }),
      save: jest.fn(),
    };
    const service = createService(repository);

    await expect(service.updatePipeline('pipeline-lead', { status: 'qualified' })).rejects.toThrow('Invalid staff lead status transition');
    expect(repository.save).not.toHaveBeenCalled();
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
    const service = createService(repository, buyerLeadDashboardSource);

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
    const service = createService(repository, buyerLeadDashboardSource);

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
    const service = createService(repository, buyerLeadDashboardSource);

    await expect(service.getBuyerLeadDetail('unknown-lead')).rejects.toThrow('Buyer lead not found');
    expect(buyerLeadDashboardSource.getBuyerLead).not.toHaveBeenCalled();
  });

  it('maps a supported seller lead from the dashboard source without private fields', async () => {
    const sellerLeadDashboardSource = {
      getSellerLead: jest.fn().mockResolvedValue({
        leadId: '11111111-1111-4111-8111-111111111111',
        status: 'submitted',
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T11:00:00.000Z',
        item: { title: 'Synthetic silver menorah', category: 'judaica' },
        evidence: [{ id: 'evidence-001', type: 'image' }],
        comparables: [{ id: 'sale-001', source: { label: 'Source unavailable', url: null } }],
        valuation: {
          status: 'supported',
          reportId: 'report-001',
          valuationRange: { min: 1200, max: 1800, currency: 'USD' },
          confidence: { level: 'low', explanation: 'Conservative fixture confidence.' },
          limitations: ['Synthetic demonstration data.'],
        },
        recommendation: { houseName: 'Synthetic Auction House', reason: 'Judaica focus' },
        alternatives: [],
        sellerChoice: { houseName: 'Synthetic Auction House' },
        catalogDraft: { title: 'Synthetic silver menorah' },
        contact: {
          preferredName: 'Synthetic Seller',
          email: 'seller.demo@example.test',
          phone: null,
          serviceConsentGranted: true,
        },
        history: [{ at: '2026-09-14T11:00:00.000Z', event: 'submitted', actor: 'seller' }],
        profileId: 'never-expose-profile-id',
        sessionId: 'never-expose-session-id',
        marketingConsent: true,
        evidencePath: '/private/evidence.jpg',
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        type: 'seller',
        status: 'submitted',
      }),
    };
    const service = createService(repository, {}, sellerLeadDashboardSource);

    const result = await service.getSellerLeadDetail('11111111-1111-4111-8111-111111111111');

    expect(result).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      item: { title: 'Synthetic silver menorah', category: 'judaica' },
      evidence: [{ id: 'evidence-001', type: 'image' }],
      valuation: {
        status: 'supported',
        valuationRange: { min: 1200, max: 1800, currency: 'USD' },
      },
      contact: {
        preferredName: 'Synthetic Seller',
        email: 'seller.demo@example.test',
        phone: null,
        serviceConsentGranted: true,
      },
      history: [{ at: '2026-09-14T11:00:00.000Z', event: 'submitted', actor: 'seller' }],
    });
    expect(result).not.toHaveProperty('profileId');
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('marketingConsent');
    expect(result).not.toHaveProperty('evidencePath');
    expect(sellerLeadDashboardSource.getSellerLead).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('keeps evidence context for a seller valuation refusal without a price range', async () => {
    const sellerLeadDashboardSource = {
      getSellerLead: jest.fn().mockResolvedValue({
        leadId: '22222222-2222-4222-8222-222222222222',
        status: 'reviewing',
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T11:00:00.000Z',
        item: { title: 'Synthetic manuscript', category: 'manuscripts' },
        evidence: [{ id: 'evidence-002', type: 'provenance' }],
        comparables: [{ id: 'sale-002', source: { label: 'Source unavailable', url: null } }],
        valuation: {
          status: 'refusal',
          reportId: 'report-002',
          reason: 'insufficient_comparables',
        },
        recommendation: null,
        alternatives: [],
        sellerChoice: null,
        catalogDraft: null,
        contact: {
          preferredName: 'Synthetic Seller',
          email: 'seller.demo@example.test',
          phone: null,
          serviceConsentGranted: true,
        },
        history: [{ at: '2026-09-14T11:00:00.000Z', event: 'ranked', actor: 'system' }],
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: '22222222-2222-4222-8222-222222222222',
        type: 'seller',
        status: 'reviewing',
      }),
    };
    const service = createService(repository, {}, sellerLeadDashboardSource);

    const result = await service.getSellerLeadDetail('22222222-2222-4222-8222-222222222222');

    expect(result.valuation).toEqual({
      status: 'refusal',
      reportId: 'report-002',
      reason: 'insufficient_comparables',
    });
    expect(result.valuation).not.toHaveProperty('valuationRange');
    expect(result.comparables).toEqual([{ id: 'sale-002', source: { label: 'Source unavailable', url: null } }]);
    expect(result.evidence).toEqual([{ id: 'evidence-002', type: 'provenance' }]);
  });

  it('withholds seller contact if a source violates the consent boundary', async () => {
    const sellerLeadDashboardSource = {
      getSellerLead: jest.fn().mockResolvedValue({
        leadId: '33333333-3333-4333-8333-333333333333',
        status: 'drafted',
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T10:00:00.000Z',
        item: { title: 'Synthetic object', category: 'judaica' },
        evidence: [],
        comparables: [],
        valuation: null,
        recommendation: null,
        alternatives: [],
        sellerChoice: null,
        catalogDraft: null,
        contact: {
          preferredName: 'Synthetic Seller',
          email: 'withhold.demo@example.test',
          phone: '+972-50-0000000',
          serviceConsentGranted: false,
        },
        history: [{ at: '2026-09-14T10:00:00.000Z', event: 'drafted', actor: 'seller' }],
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        type: 'seller',
        status: 'drafted',
      }),
    };
    const service = createService(repository, {}, sellerLeadDashboardSource);

    await expect(service.getSellerLeadDetail('33333333-3333-4333-8333-333333333333')).resolves.toMatchObject({
      contact: {
        preferredName: 'Synthetic Seller',
        email: null,
        phone: null,
        serviceConsentGranted: false,
      },
    });
  });

  it('does not query the seller source for an unknown staff lead', async () => {
    const sellerLeadDashboardSource = { getSellerLead: jest.fn() };
    const repository = { findOneBy: jest.fn().mockResolvedValue(undefined) };
    const service = createService(repository, {}, sellerLeadDashboardSource);

    await expect(service.getSellerLeadDetail('44444444-4444-4444-8444-444444444444')).rejects.toThrow('Seller lead not found');
    expect(sellerLeadDashboardSource.getSellerLead).not.toHaveBeenCalled();
  });

  it('routes a seller lead through the shared dashboard detail method', async () => {
    const sellerLeadDashboardSource = {
      getSellerLead: jest.fn().mockResolvedValue({
        leadId: '55555555-5555-4555-8555-555555555555',
        status: 'drafted',
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T10:00:00.000Z',
        item: { title: 'Synthetic object' },
        evidence: [],
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
          serviceConsentGranted: true,
        },
        history: [],
      }),
    };
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: '55555555-5555-4555-8555-555555555555',
        type: 'seller',
        status: 'drafted',
      }),
    };
    const service = createService(repository, {}, sellerLeadDashboardSource);

    await expect(service.getLeadDetail('55555555-5555-4555-8555-555555555555')).resolves.toMatchObject({
      id: '55555555-5555-4555-8555-555555555555',
      type: 'seller',
    });
    expect(sellerLeadDashboardSource.getSellerLead).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
  });
});
