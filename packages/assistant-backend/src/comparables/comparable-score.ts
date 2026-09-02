import type { AuctionLot, SellerItem, ScoredComparable, ComparableEvidence } from '@monabid/shared';

// Only a completed sale with a recorded realized price is credible evidence for valuation (S4).
// Category match is the Week 2 scoring scaffold; later weeks add creator/period/medium/etc.
export function scoreComparable(lot: AuctionLot, item: SellerItem): ScoredComparable {
  const credible = lot.status === 'sold' && lot.realizedPrice != null;
  const categoryMatch = lot.category === item.category;
  const score = categoryMatch ? 1.0 : 0.0;

  if (!credible) {
    const exclusionReason =
      lot.status !== 'sold'
        ? `Not a completed sale (status: ${lot.status}) — unsold estimates do not count as realized prices`
        : 'No realized price recorded — lot cannot contribute to valuation evidence';
    return {
      lot,
      score,
      included: false,
      matchReason: categoryMatch ? `Same category '${item.category}'` : `Different category ('${lot.category}' vs '${item.category}')`,
      exclusionReason,
    };
  }

  if (!categoryMatch) {
    return {
      lot,
      score: 0.0,
      included: false,
      matchReason: `Different category ('${lot.category}' vs '${item.category}')`,
      exclusionReason: `Category does not match — '${lot.category}' is not '${item.category}'`,
    };
  }

  return {
    lot,
    score: 1.0,
    included: true,
    matchReason: `Same category '${item.category}', completed sale with realized price`,
  };
}

// Deterministic tie-break (score desc, then date desc, then id) so identical input never reorders
// between requests — required by the "identical input keeps the same order" acceptance rule.
function compareScored(a: ScoredComparable, b: ScoredComparable): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.lot.saleDate !== b.lot.saleDate) return b.lot.saleDate.localeCompare(a.lot.saleDate);
  return a.lot.id.localeCompare(b.lot.id);
}

export function partitionAndSort(scores: ScoredComparable[]): ComparableEvidence {
  const sorted = [...scores].sort(compareScored);
  return {
    included: sorted.filter(s => s.included),
    excluded: sorted.filter(s => !s.included),
  };
}
