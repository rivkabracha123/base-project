import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StaffOperationEntity } from '../database/staff-operation.entity';
import { BUYER_LEAD_DASHBOARD_SOURCE } from './buyer-lead-dashboard-source';
import { StaffOperationsController } from './staff-operations.controller';
import { StaffOperationsService } from './staff-operations.service';

describe('Staff operations buyer lead contract', () => {
  async function createController(repository: unknown, buyerLeadDashboardSource: unknown) {
    const module = await Test.createTestingModule({
      controllers: [StaffOperationsController],
      providers: [
        StaffOperationsService,
        { provide: getRepositoryToken(StaffOperationEntity), useValue: repository },
        { provide: BUYER_LEAD_DASHBOARD_SOURCE, useValue: buyerLeadDashboardSource },
      ],
    }).compile();

    return module.get(StaffOperationsController);
  }

  it('returns a dashboard-safe result outcome through the lead endpoint handler', async () => {
    const controller = await createController(
      { findOneBy: jest.fn().mockResolvedValue({ id: 'buyer-lead-001', type: 'buyer', status: 'new' }) },
      {
        getBuyerLead: jest.fn().mockResolvedValue({
          outcome: {
            kind: 'results',
            searchRequest: {
              criteria: { category: 'rare_hebrew_manuscript' },
              hardConstraints: [{ field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' }],
            },
            groupedItems: { current: [{ id: '121421' }], historical: [{ id: '121424' }] },
          },
          contact: {
            preferredName: 'Synthetic Buyer',
            email: 'buyer.demo@example.test',
            phone: null,
            followUpStatus: 'ready',
            serviceConsent: { granted: true },
          },
          profileId: 'never-expose-profile-id',
          sessionId: 'never-expose-session-id',
          marketingConsent: { granted: true },
          fullConversation: ['never expose this'],
        }),
      },
    );

    const result = await controller.getBuyerLeadDetail('buyer-lead-001');

    expect(result).toMatchObject({
      id: 'buyer-lead-001',
      type: 'buyer',
      status: 'new',
      criteria: { category: 'rare_hebrew_manuscript' },
      hardConstraints: [{ field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' }],
      results: [{ id: '121421', group: 'current' }, { id: '121424', group: 'historical' }],
      unmatchedDemand: null,
    });
    expect(result).not.toHaveProperty('profileId');
    expect(result).not.toHaveProperty('sessionId');
    expect(result).not.toHaveProperty('marketingConsent');
    expect(result).not.toHaveProperty('fullConversation');
  });

  it('rejects an unknown lead without calling the Buyer lead source', async () => {
    const buyerLeadDashboardSource = { getBuyerLead: jest.fn() };
    const controller = await createController(
      { findOneBy: jest.fn().mockResolvedValue(undefined) },
      buyerLeadDashboardSource,
    );

    await expect(controller.getBuyerLeadDetail('unknown-lead')).rejects.toThrow('Buyer lead not found');
    expect(buyerLeadDashboardSource.getBuyerLead).not.toHaveBeenCalled();
  });
});
