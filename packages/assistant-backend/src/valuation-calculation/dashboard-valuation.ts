import { sellerLeadValuationSnapshotSchema, SellerLeadValuationSnapshot } from '@monabid/shared';
import { ValuationResult } from './valuation-calculation.service';

/** Explicit allowlist projection; never spread an audit report into a browser DTO. */
export function toSellerLeadValuationSnapshot(report: ValuationResult): SellerLeadValuationSnapshot {
  const common = {
    reportId: report.reportId,
    comparableCount: report.comparableCount,
    limitations: [...report.limitations],
    comparables: report.comparables.map(sale => ({
      id: sale.id,
      // The legacy source string has no verified public provenance. Do not expose it.
      source: { label: 'Source unavailable', url: null },
      saleDate: sale.saleDate,
      originalPrice: sale.originalPrice,
      originalCurrency: sale.originalCurrency,
      normalizedPrice: sale.normalizedPrice,
      weight: sale.weight,
    })),
    excludedComparables: report.excludedComparables.map(({ id, reason }) => ({ id, reason })),
  };
  return sellerLeadValuationSnapshotSchema.parse({
    itemId: report.itemId,
    itemVersion: report.itemVersion,
    calculationVersion: report.calculationVersion,
    dashboard: report.status === 'supported'
      ? { ...common, status: 'supported',
        valuationRange: report.valuationRange && {
          min: report.valuationRange.min, max: report.valuationRange.max, currency: report.valuationRange.currency,
        },
        confidence: { level: report.confidence.level, explanation: report.confidence.explanation } }
      : { ...common, status: 'refusal', reason: report.reason },
  });
}
