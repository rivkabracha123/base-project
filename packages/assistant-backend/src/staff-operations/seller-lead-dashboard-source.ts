export interface DashboardSellerLeadContact {
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  serviceConsentGranted: boolean;
}

export interface DashboardSellerLeadEvidence {
  id: string;
  type: string;
}

export interface DashboardSellerLeadComparable {
  id: string;
  source?: {
    label: string;
    url: string | null;
  };
}

export interface DashboardSellerLeadHistoryItem {
  at: string;
  event: 'drafted' | 'ranked' | 'chose_house' | 'submitted';
  actor: 'system' | 'seller';
}

export interface DashboardSellerLeadValuation {
  status: 'supported' | 'refusal';
  reportId?: string;
  reason?: string;
  valuationRange?: {
    min: number;
    max: number;
    currency: 'USD';
  };
  confidence?: {
    level: 'low';
    explanation: string;
  };
  limitations?: string[];
  comparableCount?: number;
  comparables?: DashboardSellerLeadComparable[];
  excludedComparables?: Array<{ id: string; reason: string }>;
}

export interface DashboardSellerLeadSourceRecord {
  leadId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  item: Record<string, unknown>;
  evidence: DashboardSellerLeadEvidence[];
  comparables: DashboardSellerLeadComparable[];
  valuation: DashboardSellerLeadValuation | null;
  recommendation: Record<string, unknown> | null;
  alternatives: Record<string, unknown>[];
  sellerChoice: Record<string, unknown> | null;
  catalogDraft: Record<string, unknown> | null;
  enquiryText?: string | null;
  contact: DashboardSellerLeadContact;
  history: DashboardSellerLeadHistoryItem[];
}

export interface SellerLeadDashboardSource {
  getSellerLead(leadId: string): Promise<DashboardSellerLeadSourceRecord | undefined>;
}

export const SELLER_LEAD_DASHBOARD_SOURCE = Symbol('SELLER_LEAD_DASHBOARD_SOURCE');
