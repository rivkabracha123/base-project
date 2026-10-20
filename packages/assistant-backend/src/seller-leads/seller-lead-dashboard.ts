import type { DashboardValuation, SellerLeadDashboardDetail } from '@monabid/shared';
import type { SellerLeadEntity } from '../database/seller-lead.entity';

const UNSAFE_SOURCE = /^(file:|https?:)?\/|\\|[?&]signature=|signed/i;
const UNSAFE_DASHBOARD_URL = /^file:|[\\]|[?&]signature=|signed/i;

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

function safeDashboardSource(source: DashboardValuation['comparables'][number]['source']) {
  if (source.url && UNSAFE_DASHBOARD_URL.test(source.url)) {
    return { label: 'Source unavailable', url: null };
  }
  return { label: source.label, url: source.url };
}

function toDashboardValuation(valuation: SellerLeadEntity['valuation']): DashboardValuation | null {
  if (!valuation) return null;
  const comparables = valuation.comparables.map((row) => ({
    id: row.id,
    source: safeDashboardSource(row.source),
    ...(row.saleDate ? { saleDate: row.saleDate } : {}),
  }));
  const base = {
    reportId: valuation.reportId,
    comparableCount: valuation.comparableCount,
    limitations: valuation.limitations,
    comparables,
    excludedComparables: valuation.excludedComparables,
  };
  if (valuation.status === 'supported') {
    return {
      status: 'supported',
      ...base,
      confidence: valuation.confidence,
      valuationRange: valuation.valuationRange,
    };
  }
  return {
    status: 'refusal',
    ...base,
    reason: valuation.reason,
  };
}

/**
 * S5 → P5 dashboard detail. Strips profileId, session, marketing consent,
 * conversation, file paths, signed URLs, and raw evidence payloads.
 */
export function toSellerLeadDashboardDetail(lead: SellerLeadEntity): SellerLeadDashboardDetail {
  const ranking = lead.recommendation;
  const updatedAt = lead.updatedAt ?? lead.createdAt;
  const granted = lead.serviceConsent === true;
  return {
    leadId: lead.id,
    status: lead.status ?? 'draft',
    createdAt: lead.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    item: safeItem(lead),
    evidence: safeEvidence(lead),
    comparables: safeComparables(lead),
    valuation: toDashboardValuation(lead.valuation),
    enquiryText: lead.enquiryText ?? null,
    recommendation: ranking?.recommendation ?? null,
    alternatives: ranking?.alternatives ?? [],
    sellerChoice: lead.sellerChoice ?? null,
    catalogDraft: lead.catalogDraft ?? null,
    contact: {
      preferredName: lead.contact.preferredName || null,
      email: granted ? lead.contact.email ?? null : null,
      phone: granted ? lead.contact.phone ?? null : null,
      serviceConsentGranted: granted,
    },
    history: lead.history ?? [],
  };
}
