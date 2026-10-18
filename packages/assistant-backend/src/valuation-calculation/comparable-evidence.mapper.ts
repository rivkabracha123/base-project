import type { ComparableEvidence } from '@monabid/shared';
import type { ExcludedComparable, ValuationInput } from './valuation-calculation.service';

import { safeReason } from './privacy-projection';
export { WITHHELD_REASON } from './privacy-projection';

// Pure S3 -> S4 boundary: Heni's ComparableEvidence becomes S4's ValuationInput.
// score -> weight; realizedPrice -> soldPrice. Heni's exclusions are kept as evidence, not formula inputs.
// An "included" lot that cannot be priced is excluded with a reason instead of crashing the valuation.
export function mapEvidenceToValuationInput(
  evidence: ComparableEvidence,
  itemId: string,
  itemVersion: string,
): ValuationInput {
  const comparables: ValuationInput['comparables'] = [];
  const excludedComparables: ExcludedComparable[] = evidence.excluded.map(entry => ({
    id: entry.lot.id,
    reason: safeReason(entry.exclusionReason ?? 'excluded_by_comparable_selection'),
  }));

  for (const { lot, score } of evidence.included) {
    if (!lot.realizedPrice) {
      excludedComparables.push({ id: lot.id, reason: 'missing_realized_price' });
    } else if (lot.status !== 'sold') {
      excludedComparables.push({ id: lot.id, reason: 'not_sold' });
    } else {
      comparables.push({
        id: lot.id, saleDate: lot.saleDate, soldPrice: lot.realizedPrice.amount,
        currency: lot.realizedPrice.currency, category: lot.category, status: 'sold',
        source: lot.source.provider, weight: score,
      });
    }
  }

  return { itemId, itemVersion, comparables, excludedComparables };
}
