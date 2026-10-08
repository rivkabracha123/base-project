import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Repository } from 'typeorm';
import type { AuctionLotEntity } from '../database/auction-lot.entity';
import type { StaffOperationEntity } from '../database/staff-operation.entity';
import { LotsService } from '../lots/lots.service';
import type {
  BuyerLeadDashboardSource,
  BuyerSearchOutcome as StaffBuyerSearchOutcome,
  DashboardBuyerLeadSourceRecord,
} from '../staff-operations/buyer-lead-dashboard-source';
import { StaffOperationsService } from '../staff-operations/staff-operations.service';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchOrchestrator } from './buyer-search.orchestrator';
import type { BuyerUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import { UnmatchedDemandStore } from './unmatched-demand.store';

// Buyer search -> staff dashboard contract: one named fixture from buyer criteria through the real LotsService
// into the real staff buyer-lead detail, read back from the demand store. Staff dashboard code is used as-is, never changed.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as { scenarios: Array<{ name: string; criteria: BuyerCriteria }> };

type StaffUnmatchedOutcome = Extract<StaffBuyerSearchOutcome, { kind: 'unmatched' }>;

// Compile-time half of the contract: the recorded view must fit the staff dashboard's unmatched outcome shape.
// The staff dashboard types criteria as Record<string, unknown>, which the BuyerCriteria interface cannot satisfy, so only criteria is copied into a plain object.
function toStaffUnmatchedOutcome(view: BuyerUnmatchedDemandDashboardView): StaffUnmatchedOutcome {
  const { searchRequest } = view.unmatchedDemand;
  return {
    kind: 'unmatched',
    view: {
      ...view,
      unmatchedDemand: { ...view.unmatchedDemand, searchRequest: { ...searchRequest, criteria: { ...searchRequest.criteria } } },
    },
  };
}

// Fake DB layer for the real LotsService that finds nothing, so the search is a no-result.
function emptyLotsRepository(): Repository<AuctionLotEntity> {
  const queryBuilder: Record<string, jest.Mock> = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawAndEntities: jest.fn(async () => ({ entities: [], raw: [] })),
    getCount: jest.fn(async () => 0),
  };
  return { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as unknown as Repository<AuctionLotEntity>;
}

describe('Buyer search -> staff dashboard unmatched-demand contract', () => {
  const leadId = 'buyer-lead-staff-contract';
  const scenario = contract.scenarios.find((entry) => entry.name === 'canonical-english-category')!;
  const criteria: BuyerCriteria = { ...scenario.criteria, price: { min: 500, max: 800, currency: 'USD' } };

  it('shows the recorded demand on the staff buyer-lead detail, with the buyer criteria and budget intact', async () => {
    const demandStore = new UnmatchedDemandStore();
    const orchestrator = new BuyerSearchOrchestrator(new LotsService(emptyLotsRepository()), undefined, demandStore);

    await orchestrator.search({
      criteria,
      language: 'en',
      leadId,
      status: 'new',
      createdAt: '2026-10-07T09:00:00.000Z',
      searchedAt: '2026-10-07T09:01:00.000Z',
    });

    const recorded = demandStore.get(leadId);
    expect(recorded).toBeDefined();

    // The staff dashboard's source port, fed from the demand store; contact is synthetic and without consent.
    const record: DashboardBuyerLeadSourceRecord = {
      id: leadId,
      type: 'buyer',
      status: recorded!.status,
      outcome: toStaffUnmatchedOutcome(recorded!),
      contact: {
        preferredName: null,
        email: null,
        phone: null,
        followUpStatus: 'consent_required',
        serviceConsent: { granted: false },
      },
    };
    const source: BuyerLeadDashboardSource = { getBuyerLead: async (id) => (id === leadId ? record : undefined) };
    const staffRepository = {
      findOneBy: jest.fn(async () => ({ id: leadId, type: 'buyer', status: 'new' })),
    } as unknown as Repository<StaffOperationEntity>;

    const detail = await new StaffOperationsService(staffRepository, source).getBuyerLeadDetail(leadId);

    expect(detail.unmatchedDemand).toEqual({ reason: 'no_results', originalCriteria: criteria });
    expect(detail.results).toEqual([]);
    expect(detail.criteria).toEqual(criteria);
    expect(detail.hardConstraints).toContainEqual(
      expect.objectContaining({ field: 'price', value: criteria.price }),
    );
    expect(JSON.stringify(detail)).not.toContain('conversation');
  });
});
