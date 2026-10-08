import { BuyerHardConstraint, DashboardBuyerLeadContact } from './buyer-lead-dashboard-source';

export interface StaffBuyerLeadDetail {
  id: string;
  type: 'buyer';
  status: string;
  criteria: Record<string, unknown>;
  hardConstraints: BuyerHardConstraint[];
  results: Array<{ id: string; group: 'current' | 'historical' }>;
  unmatchedDemand: {
    reason: 'no_results';
    originalCriteria: Record<string, unknown>;
  } | null;
  contact: DashboardBuyerLeadContact;
}
