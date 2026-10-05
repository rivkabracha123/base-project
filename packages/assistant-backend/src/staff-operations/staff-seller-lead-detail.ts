import {
  DashboardSellerLeadComparable,
  DashboardSellerLeadContact,
  DashboardSellerLeadEvidence,
  DashboardSellerLeadHistoryItem,
  DashboardSellerLeadValuation,
} from './seller-lead-dashboard-source';

export interface StaffSellerLeadDetail {
  id: string;
  type: 'seller';
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
  contact: DashboardSellerLeadContact;
  history: DashboardSellerLeadHistoryItem[];
}
