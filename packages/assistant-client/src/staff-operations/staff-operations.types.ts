export interface StaffLead {
  id: string;
  type: 'buyer' | 'seller';
  clientName: string;
  status: string;
  requestDetails: string;
  createdAt: string;
}

export interface BuyerLeadContact {
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

export interface BuyerHardConstraint {
  field: string;
  operator: string;
  value: unknown;
  reason: string;
}

export interface StaffBuyerLeadDetail {
  id: string;
  type: 'buyer';
  status: string;
  criteria: Record<string, unknown>;
  hardConstraints: BuyerHardConstraint[];
  results: Array<{
    id: string;
    group: 'current' | 'historical';
  }>;
  unmatchedDemand: {
    reason: string;
    originalCriteria: Record<string, unknown>;
  } | null;
  contact: BuyerLeadContact;
}

export interface SellerLeadContact {
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  serviceConsentGranted: boolean;
}

export interface SellerLeadValuation {
  status: 'supported' | 'refusal';
  reportId?: string;
  reason?: string;
  valuationRange?: { min: number; max: number; currency: 'USD' };
  confidence?: { level: 'low'; explanation: string };
  limitations?: string[];
  comparableCount?: number;
  comparables?: Array<{ id: string; source?: { label: string; url: string | null } }>;
  excludedComparables?: Array<{ id: string; reason: string }>;
}

export interface StaffSellerLeadDetail {
  id: string;
  type: 'seller';
  status: string;
  createdAt: string;
  updatedAt: string;
  item: Record<string, unknown> | null;
  evidence: Array<{ id: string; type: string }>;
  comparables: Array<{ id: string; source?: { label: string; url: string | null } }>;
  valuation: SellerLeadValuation | null;
  recommendation: Record<string, unknown> | null;
  alternatives: Record<string, unknown>[];
  sellerChoice: Record<string, unknown> | null;
  catalogDraft: Record<string, unknown> | null;
  contact: SellerLeadContact;
  history: Array<{
    at: string;
    event: 'drafted' | 'ranked' | 'chose_house' | 'submitted';
    actor: 'system' | 'seller';
  }>;
}

export type StaffLeadDetail = StaffBuyerLeadDetail | StaffSellerLeadDetail;
