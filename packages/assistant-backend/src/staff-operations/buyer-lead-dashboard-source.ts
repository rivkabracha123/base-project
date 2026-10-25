export interface BuyerHardConstraint {
  field: string;
  operator: string;
  value: unknown;
  reason: string;
}

interface BuyerSearchRequest {
  criteria: Record<string, unknown>;
  hardConstraints: BuyerHardConstraint[];
}

export type BuyerSearchOutcome =
  | {
      kind: 'results';
      searchRequest: BuyerSearchRequest;
      groupedItems: {
        current: Array<{ id: string }>;
        historical: Array<{ id: string }>;
      };
    }
  | {
      kind: 'unmatched';
      view: {
        unmatchedDemand: {
          reason: 'no_results';
          searchRequest: BuyerSearchRequest;
        };
      };
    };

export interface DashboardBuyerLeadContact {
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  followUpStatus: 'ready' | 'consent_required' | 'contact_missing';
  serviceConsent: {
    granted: boolean;
    grantedAt?: string;
    channel?: string;
    policyVersion?: string;
  };
}

export interface DashboardBuyerLeadSourceRecord {
  id: string;
  type: 'buyer';
  status: string;
  outcome: BuyerSearchOutcome;
  contact: DashboardBuyerLeadContact;
}

/** A safe summary for rendering an anonymous Buyer-owned demand in the staff list. */
export interface DashboardBuyerLeadListRecord extends DashboardBuyerLeadSourceRecord {
  clientName: string;
  requestDetails: string;
  category?: string;
  createdAt: Date;
  pipelineAvailable?: boolean;
}

export interface BuyerLeadDashboardSource {
  getBuyerLead(leadId: string): Promise<DashboardBuyerLeadSourceRecord | undefined>;
  /** Optional while older deterministic sources are phased out. */
  listBuyerLeads?(): Promise<DashboardBuyerLeadListRecord[]>;
}

export const BUYER_LEAD_DASHBOARD_SOURCE = Symbol('BUYER_LEAD_DASHBOARD_SOURCE');
