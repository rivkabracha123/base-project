import type {
  CatalogDraft,
  HouseRanking,
  SellerChoice,
  SellerLeadEvidence,
  SellerLeadHistoryEvent,
  SellerLeadItem,
  SellerLeadStatus,
  SellerLeadValuation,
} from '@monabid/shared';
import type { SellerLeadContact, SellerLeadEntity } from '../database/seller-lead.entity';

/**
 * S5 → P5 dashboard row.
 * Week 5 adds catalog draft, item, evidence, valuation, status, and history
 * so P5 can operate an evidence-led enquiry without contacting a house.
 */
export interface SellerLeadSummary {
  id: string;
  profileId: string;
  contact: SellerLeadContact;
  recommendation: HouseRanking | null;
  sellerChoice: SellerChoice | null;
  catalogDraft: CatalogDraft | null;
  item: SellerLeadItem | null;
  evidence: SellerLeadEvidence[] | null;
  valuation: SellerLeadValuation | null;
  enquiryText: string | null;
  status: SellerLeadStatus;
  history: SellerLeadHistoryEvent[];
  createdAt: string;
}

export function toSellerLeadSummary(lead: SellerLeadEntity): SellerLeadSummary {
  return {
    id: lead.id,
    profileId: lead.profileId,
    contact: lead.contact,
    recommendation: lead.recommendation ?? null,
    sellerChoice: lead.sellerChoice ?? null,
    catalogDraft: lead.catalogDraft ?? null,
    item: lead.item ?? null,
    evidence: lead.evidence ?? null,
    valuation: lead.valuation ?? null,
    enquiryText: lead.enquiryText ?? null,
    status: lead.status ?? 'draft',
    history: lead.history ?? [],
    createdAt: lead.createdAt.toISOString(),
  };
}
