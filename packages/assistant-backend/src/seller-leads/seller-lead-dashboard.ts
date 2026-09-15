import type { SellerLeadDashboardDetail } from '@monabid/shared';
import type { SellerLeadEntity } from '../database/seller-lead.entity';

const UNSAFE_SOURCE = /^(file:|https?:)?\/|\\|[?&]signature=|signed/i;

function safeEvidence(lead: SellerLeadEntity): SellerLeadDashboardDetail['evidence'] {
  return (lead.evidence ?? []).map((row) => ({
    id: row.id,
    type: row.type,
  }));
}

function safeComparables(lead: SellerLeadEntity): SellerLeadDashboardDetail['comparables'] {
  return (lead.comparables ?? [])
    .filter((row) => !row.source || !UNSAFE_SOURCE.test(row.source))
    .map((row) => ({
      id: row.id,
      ...(row.source ? { source: row.source } : {}),
    }));
}

function safeItem(lead: SellerLeadEntity): SellerLeadDashboardDetail['item'] {
  if (!lead.item) return null;
  return {
    id: lead.item.id,
    category: lead.item.category,
    title: lead.item.title,
    evidenceIds: lead.item.evidenceIds,
  };
}

/**
 * S5 → P5 dashboard detail. Strips profileId, session, marketing consent,
 * conversation, file paths, signed URLs, and raw evidence payloads.
 */
export function toSellerLeadDashboardDetail(lead: SellerLeadEntity): SellerLeadDashboardDetail {
  const ranking = lead.recommendation;
  const updatedAt = lead.updatedAt ?? lead.createdAt;
  return {
    leadId: lead.id,
    status: lead.status ?? 'draft',
    createdAt: lead.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    item: safeItem(lead),
    evidence: safeEvidence(lead),
    comparables: safeComparables(lead),
    valuation: lead.valuation ?? null,
    recommendation: ranking?.recommendation ?? null,
    alternatives: ranking?.alternatives ?? [],
    sellerChoice: lead.sellerChoice ?? null,
    catalogDraft: lead.catalogDraft ?? null,
    contact: {
      preferredName: lead.contact.preferredName,
      ...(lead.contact.email ? { email: lead.contact.email } : {}),
      ...(lead.contact.phone ? { phone: lead.contact.phone } : {}),
      serviceConsent: lead.serviceConsent === true,
    },
    history: lead.history ?? [],
  };
}
