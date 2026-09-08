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
