import type { AuctionLot, SellerItem, ScoredComparable, ComparableEvidence } from '@monabid/shared';

// Week 3 — gradual scoring weights. Category is a hard gate; within the same category, score is
// weighted by how much of the seller's confirmed evidence the lot's text actually corroborates.
const CATEGORY_WEIGHT = 0.7;
const MATERIALS_WEIGHT = 0.3;

// Week 3 — minimum graduated score for a same-category, sold, realized-price lot to still count
// as credible evidence. Category alone (no confirmed materials to check, or confirmed materials
// that fully corroborate) scores 1.0 and always clears this. Confirmed materials that the lot's
// text does not corroborate at all score CATEGORY_WEIGHT (0.7) and must NOT clear it — sold +
// realizedPrice is necessary but not sufficient (Rule: "Weak similarity cannot appear as credible
// evidence"). Set strictly between those two known values (0.7 < 0.8 <= 1.0).
const WEAK_SIMILARITY_THRESHOLD = 0.8;

// Which of the seller's confirmed materials actually appear in the lot's free-text title/description
// (the only place materials are recorded on AuctionLot today — see docs/decisions.md scoring inputs
// and the current auctionLotSchema, which has no structured materials field). Returned in the
// seller's original confirmed order/casing, for use in both the score and the reason text.
function matchedMaterials(lot: AuctionLot, materials: string[] | undefined): string[] {
  if (!materials || materials.length === 0) return [];
  const text = `${lot.title.en} ${lot.description.en}`.toLowerCase();
  return materials.filter(m => text.includes(m.toLowerCase()));
}

// No confirmed materials to check against is treated as neutral (full credit) so the Week 2
// { category } shape keeps scoring exactly as before.
function materialsOverlap(matched: string[], materials: string[] | undefined): number {
  if (!materials || materials.length === 0) return 1;
  return matched.length / materials.length;
}

function computeScore(matched: string[], item: SellerItem, categoryMatch: boolean): number {
  if (!categoryMatch) return 0;
  return CATEGORY_WEIGHT + MATERIALS_WEIGHT * materialsOverlap(matched, item.materials);
}

// Only a completed sale with a recorded realized price is credible evidence for valuation (S4).
// Category match is a hard gate; the graduated score reflects how much of the seller's confirmed
// evidence the lot corroborates (see computeScore).
// Week 5 — a realized price of 0 is not a usable realized price: moneySchema allows 0, but S4
// requires a positive soldPrice (ComparableSaleDto @IsPositive). It takes the existing
// "No realized price recorded" exclusion, which S4's privacy projection already allowlists.
export function scoreComparable(lot: AuctionLot, item: SellerItem): ScoredComparable {
  const credible = lot.status === 'sold' && lot.realizedPrice != null && lot.realizedPrice.amount > 0;
  const categoryMatch = lot.category === item.category;
  const matched = matchedMaterials(lot, item.materials);
  const score = computeScore(matched, item, categoryMatch);

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
      score,
      included: false,
      matchReason: `Different category ('${lot.category}' vs '${item.category}')`,
      exclusionReason: `Category does not match — '${lot.category}' is not '${item.category}'`,
    };
  }

  if (score < WEAK_SIMILARITY_THRESHOLD) {
    const unmatched = (item.materials ?? []).filter(m => !matched.includes(m));
    const materialsNote = unmatched.length > 0 ? `; confirmed materials not found in listing: ${unmatched.join(', ')}` : '';
    return {
      lot,
      score,
      included: false,
      matchReason: `Same category '${item.category}', completed sale with realized price`,
      exclusionReason: `Similarity too weak to count as credible evidence (score ${score.toFixed(2)} below ${WEAK_SIMILARITY_THRESHOLD})${materialsNote}`,
    };
  }

  const materialsNote = matched.length > 0 ? `; materials match: ${matched.join(', ')}` : '';
  return {
    lot,
    score,
    included: true,
    matchReason: `Same category '${item.category}', completed sale with realized price${materialsNote}`,
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
