import { Injectable } from '@nestjs/common';
import {
  BuyerLeadDashboardSource,
  DashboardBuyerLeadSourceRecord,
} from './buyer-lead-dashboard-source';

const hardConstraints = [
  { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
  { field: 'format', operator: 'equals', value: 'original', reason: 'buyer request' },
];

const fixtureLeads: DashboardBuyerLeadSourceRecord[] = [
  {
    id: 'buyer-lead-001',
    type: 'buyer',
    status: 'new',
    outcome: {
      kind: 'results',
      searchRequest: {
        criteria: { category: 'rare_hebrew_manuscript' },
        hardConstraints,
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
  },
  {
    id: 'buyer-lead-002',
    type: 'buyer',
    status: 'new',
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
            hardConstraints,
          },
        },
      },
    },
    contact: {
      preferredName: 'Anonymous Buyer',
      email: null,
      phone: null,
      followUpStatus: 'consent_required',
      serviceConsent: { granted: false },
    },
  },
];

@Injectable()
export class FixtureBuyerLeadDashboardSource implements BuyerLeadDashboardSource {
  async getBuyerLead(leadId: string): Promise<DashboardBuyerLeadSourceRecord | undefined> {
    // This deterministic source is replaced by the Buyer Lead API integration.
    return fixtureLeads.find((lead) => lead.id === leadId);
  }
}
