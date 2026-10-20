import type { AuctionLot } from '@monabid/shared';
import { scoreComparable, partitionAndSort } from './comparable-score';

const base: AuctionLot = {
  id: 'lot-1',
  source: { provider: 'demo', recordId: '1', url: 'https://example.com/1', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Demo House' },
  auctionTitle: 'Demo Auction',
  lotNumber: '1',
  title: { en: 'Demo Lot' },
  description: { en: 'A demo lot.' },
  category: 'rare_books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1000, currency: 'USD' },
};

const item = { category: 'rare_books' };

describe('scoreComparable', () => {
  it('includes a sold same-category lot with a realized price', () => {
    const result = scoreComparable(base, item);
    expect(result.included).toBe(true);
    expect(result.score).toBe(1.0);
    expect(result.exclusionReason).toBeUndefined();
  });

  it('excludes an unsold lot even when the category matches', () => {
    const lot: AuctionLot = { ...base, status: 'unsold', realizedPrice: undefined };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/unsold/i);
  });

  it('excludes a sold same-category lot that has no realized price', () => {
    const lot: AuctionLot = { ...base, realizedPrice: undefined };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/realized price/i);
  });

  it('excludes a credible lot in a different category with score 0', () => {
    const lot: AuctionLot = { ...base, category: 'judaica' };
    const result = scoreComparable(lot, item);
    expect(result.included).toBe(false);
    expect(result.score).toBe(0.0);
    expect(result.exclusionReason).toMatch(/category/i);
  });

  it('preserves the lot on every result so callers have the full evidence', () => {
    const result = scoreComparable(base, item);
    expect(result.lot).toEqual(base);
  });

  it('provides a non-empty matchReason on every result', () => {
    expect(scoreComparable(base, item).matchReason).toBeTruthy();
    expect(scoreComparable({ ...base, status: 'unsold', realizedPrice: undefined }, item).matchReason).toBeTruthy();
    expect(scoreComparable({ ...base, category: 'judaica' }, item).matchReason).toBeTruthy();
  });
});

describe('partitionAndSort', () => {
  const sold = (id: string, date: string, cat = 'rare_books'): AuctionLot => ({
    ...base, id, category: cat, saleDate: date,
    realizedPrice: { amount: 500, currency: 'USD' },
  });
  const unsold = (id: string, date: string): AuctionLot => ({
    ...base, id, saleDate: date, status: 'unsold', realizedPrice: undefined,
  });

  it('places credible lots in included and non-credible in excluded', () => {
    const scores = [
      scoreComparable(sold('a', '2025-01-01'), item),
      scoreComparable(unsold('b', '2025-01-01'), item),
    ];
    const result = partitionAndSort(scores);
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.included[0]!.lot.id).toBe('a');
    expect(result.excluded[0]!.lot.id).toBe('b');
  });

  it('sorts included by score descending then saleDate descending', () => {
    const scores = [
      scoreComparable(sold('older', '2024-01-01'), item),
      scoreComparable(sold('newer', '2025-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included[0]!.lot.id).toBe('newer');
    expect(included[1]!.lot.id).toBe('older');
  });

  it('breaks ties by lot id so order is fully deterministic', () => {
    const scores = [
      scoreComparable(sold('zzz', '2025-01-01'), item),
      scoreComparable(sold('aaa', '2025-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included[0]!.lot.id).toBe('aaa');
    expect(included[1]!.lot.id).toBe('zzz');
  });

  it('produces identical output for identical input on repeated calls', () => {
    const scores = [
      scoreComparable(sold('x', '2025-01-01'), item),
      scoreComparable(unsold('y', '2024-06-01'), item),
      scoreComparable(sold('m', '2024-01-01'), item),
    ];
    const first = partitionAndSort(scores);
    const second = partitionAndSort(scores);
    expect(first.included.map(s => s.lot.id)).toEqual(second.included.map(s => s.lot.id));
    expect(first.excluded.map(s => s.lot.id)).toEqual(second.excluded.map(s => s.lot.id));
  });

  it('unsold lots never appear in the included list', () => {
    const scores = [
      scoreComparable(unsold('u1', '2025-01-01'), item),
      scoreComparable(unsold('u2', '2024-01-01'), item),
    ];
    const { included } = partitionAndSort(scores);
    expect(included).toHaveLength(0);
  });
});

// Week 3 — Test 1 (RED first): category match alone must no longer produce a flat binary
// score. Two same-category, sold, realized-price lots with different real evidence overlap
// against the seller's confirmed materials must rank differently.
describe('gradual scoring (Week 3)', () => {
  const itemWithMaterials = { category: 'paintings', materials: ['oil', 'canvas'] };

  const materialsOverlapLot: AuctionLot = {
    ...base,
    id: 'lot-strong-materials',
    category: 'paintings',
    title: { en: 'Oil on canvas portrait' },
    description: { en: 'A signed oil on canvas painting.' },
  };

  const noMaterialsOverlapLot: AuctionLot = {
    ...base,
    id: 'lot-no-materials-overlap',
    category: 'paintings',
    title: { en: 'Bronze sculpture' },
    description: { en: 'A cast bronze figure on a marble base.' },
  };

  it('scores a lot whose materials overlap the confirmed facts higher than one that does not', () => {
    const strong = scoreComparable(materialsOverlapLot, itemWithMaterials);
    const weak = scoreComparable(noMaterialsOverlapLot, itemWithMaterials);

    expect(strong.score).toBeGreaterThan(weak.score);
  });

  // Week 3 — Test 2 (RED first): sold + realizedPrice is necessary but not sufficient. When the
  // seller has confirmed materials that the lot's text does not corroborate at all, category match
  // alone must not be enough to make it a credible comparable — it must be excluded as too weak.
  it('excludes a sold, realized-price, same-category lot when similarity to confirmed facts is too weak', () => {
    const result = scoreComparable(noMaterialsOverlapLot, itemWithMaterials);

    // Sanity: the durable Rule 1 preconditions are actually met here — this is not an
    // unsold/missing-price case, it is specifically a weak-similarity case.
    expect(noMaterialsOverlapLot.status).toBe('sold');
    expect(noMaterialsOverlapLot.realizedPrice).toBeDefined();
    expect(noMaterialsOverlapLot.category).toBe(itemWithMaterials.category);

    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/similarity|weak/i);
  });

  // Week 3 — Test 3 (RED first): matchReason/exclusionReason must name the actual matched (or
  // unmatched) confirmed facts, not a generic "category match" / score-only sentence. The reason
  // is only trustworthy if it is derived from data that really exists on item and lot.
  const partialMaterialsOverlapLot: AuctionLot = {
    ...base,
    id: 'lot-partial-materials-overlap',
    category: 'paintings',
    title: { en: 'Canvas study, unsigned' },
    description: { en: 'A small canvas study, medium unconfirmed.' },
  };

  it('names the confirmed materials that actually matched when both are found', () => {
    const result = scoreComparable(materialsOverlapLot, itemWithMaterials);

    expect(result.included).toBe(true);
    expect(result.matchReason).toMatch(/oil/i);
    expect(result.matchReason).toMatch(/canvas/i);
  });

  it('names only the confirmed material that actually matched on a partial overlap, not the one that did not', () => {
    const result = scoreComparable(partialMaterialsOverlapLot, itemWithMaterials);

    expect(result.matchReason).toMatch(/canvas/i);
    expect(result.matchReason).not.toMatch(/oil/i);
  });

  it('names the confirmed materials that failed to corroborate when similarity is too weak to be credible', () => {
    const result = scoreComparable(noMaterialsOverlapLot, itemWithMaterials);

    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/oil/i);
    expect(result.exclusionReason).toMatch(/canvas/i);
  });

  // Week 3 — Test 4 (RED first): even with strong similarity (full materials overlap, same
  // category), an unsold lot's estimate must never be treated as a realized price. Rule:
  // "Unsold estimates never count as realized prices."
  it('never treats an unsold lot\'s estimate as a realized price, even with strong similarity', () => {
    const unsoldWithEstimateLot: AuctionLot = {
      ...materialsOverlapLot,
      id: 'lot-unsold-with-estimate-strong-match',
      status: 'unsold',
      realizedPrice: undefined,
      estimate: { low: { amount: 800, currency: 'USD' }, high: { amount: 1200, currency: 'USD' } },
    };

    // Sanity: this lot really is a strong similarity match, and really has no realized price —
    // only an estimate. If estimate were ever substituted for realizedPrice, this is exactly
    // the case that would slip through.
    expect(unsoldWithEstimateLot.status).toBe('unsold');
    expect(unsoldWithEstimateLot.realizedPrice).toBeUndefined();
    expect(unsoldWithEstimateLot.estimate).toBeDefined();
    expect(unsoldWithEstimateLot.category).toBe(itemWithMaterials.category);

    const result = scoreComparable(unsoldWithEstimateLot, itemWithMaterials);

    expect(result.included).toBe(false);
    // The exclusion must be framed around it not being a completed/realized sale — not around
    // the estimate amount, which must never be quoted as if it were realized evidence.
    expect(result.exclusionReason).toMatch(/not a completed sale|unsold|realized/i);
    expect(result.exclusionReason).not.toMatch(/800|1200/);
    expect(result.exclusionReason).toMatch(/estimates? do(es)? not count as realized/i);
  });

  // Week 3 — Test 5: 'sold' alone is not sufficient — realizedPrice must actually be present, even
  // when category matches and similarity is strong (full materials overlap). The Week 2 baseline
  // spec already covers this with a plain { category } item (no secondary evidence); this proves
  // the same rule holds when similarity would otherwise be strong enough to be a good comparable.
  // An optional estimate is allowed to be present — it just must not stand in for realizedPrice.
  it('excludes a sold, same-category, strongly-similar lot when realizedPrice is missing, even if an estimate exists', () => {
    const soldWithoutRealizedPriceLot: AuctionLot = {
      ...materialsOverlapLot,
      id: 'lot-sold-no-realized-price-strong-match',
      status: 'sold',
      realizedPrice: undefined,
      estimate: { low: { amount: 800, currency: 'USD' }, high: { amount: 1200, currency: 'USD' } },
    };

    // Sanity: this really is the "sold, strong similarity, but no realized price" case —
    // not the unsold case (Test 4) and not the weak-similarity case (Test 2).
    expect(soldWithoutRealizedPriceLot.status).toBe('sold');
    expect(soldWithoutRealizedPriceLot.realizedPrice).toBeUndefined();
    expect(soldWithoutRealizedPriceLot.estimate).toBeDefined();
    expect(soldWithoutRealizedPriceLot.category).toBe(itemWithMaterials.category);

    const result = scoreComparable(soldWithoutRealizedPriceLot, itemWithMaterials);

    expect(result.included).toBe(false);
    expect(result.exclusionReason).toMatch(/realized price/i);
    expect(result.exclusionReason).not.toMatch(/800|1200/);
  });

  // Week 3 — Test 6 (RED first, unless already correct): rank several credible comparables with
  // genuinely different graduated scores (not the old flat 1.0/0.0), including a real tie within
  // the same score, and prove the whole ranked result — order, score, matchReason, exclusionReason —
  // is byte-for-byte identical across repeated calls on identical input.
  it('ranks credible comparables by graduated score, breaks a real tie deterministically, and repeats identically', () => {
    const fullMatchNewer: AuctionLot = {
      ...materialsOverlapLot,
      id: 'lot-rank-full-newer',
      saleDate: '2025-07-01',
    };
    const fullMatchSameDateAsFirst: AuctionLot = {
      ...materialsOverlapLot,
      id: 'lot-rank-full-tie-same-date-zzz',
      saleDate: '2025-06-01',
    };
    const fullMatch: AuctionLot = {
      ...materialsOverlapLot,
      id: 'lot-rank-full',
      saleDate: '2025-06-01',
    };
    const partialMatch: AuctionLot = {
      ...partialMaterialsOverlapLot,
      id: 'lot-rank-partial',
      saleDate: '2025-06-01',
    };

    const lots = [fullMatch, partialMatch, fullMatchNewer, fullMatchSameDateAsFirst];

    function rank(): ReturnType<typeof partitionAndSort> {
      const scores = lots.map(lot => scoreComparable(lot, itemWithMaterials));
      return partitionAndSort(scores);
    }

    const first = rank();

    // Sanity: two genuinely different score levels are actually present (this is the point of
    // Test 6 — not the old binary 1.0/0.0), and a real tie exists at the top score level.
    const scoreById = new Map(first.included.map(s => [s.lot.id, s.score]));
    expect(scoreById.get('lot-rank-full')).toBe(1);
    expect(scoreById.get('lot-rank-partial')).toBeCloseTo(0.85);
    expect(scoreById.get('lot-rank-full')).toBe(scoreById.get('lot-rank-full-newer'));
    expect(scoreById.get('lot-rank-full')).toBe(scoreById.get('lot-rank-full-tie-same-date-zzz'));

    // Expected order: score desc (1.0 group before 0.85), then saleDate desc within the tie
    // (2025-07-01 before 2025-06-01), then lot id asc for the remaining same-score-same-date tie
    // (existing tie-break rule, unchanged).
    expect(first.included.map(s => s.lot.id)).toEqual([
      'lot-rank-full-newer',
      'lot-rank-full',
      'lot-rank-full-tie-same-date-zzz',
      'lot-rank-partial',
    ]);

    const second = rank();
    expect(second).toEqual(first);
  });
});

// Week 5 — sparse data, credible realized-sale boundary, outlier boundary, and inclusion/exclusion
// explanations. S3 never applies the three-sale minimum (that is S4's refusal rule) and never
// excludes on price (no outlier rule is agreed; S4 records outlier treatment).
describe('Week 5 — inclusion/exclusion boundary', () => {
  const NO_REALIZED_PRICE = 'No realized price recorded — lot cannot contribute to valuation evidence';
  const paintingItem = { category: 'paintings', materials: ['oil', 'canvas'] };
  const strongLot: AuctionLot = {
    ...base,
    id: 'w5-strong',
    category: 'paintings',
    title: { en: 'Oil on canvas portrait' },
    description: { en: 'A signed oil on canvas painting.' },
  };

  it('excludes a sold same-category lot whose realized price is zero, using the existing no-realized-price reason', () => {
    const zeroPriceLot: AuctionLot = { ...strongLot, id: 'w5-zero-price', realizedPrice: { amount: 0, currency: 'USD' } };

    const zero = scoreComparable(zeroPriceLot, paintingItem);
    const valid = scoreComparable(strongLot, paintingItem);

    expect(zero.included).toBe(false);
    expect(zero.exclusionReason).toBe(NO_REALIZED_PRICE);
    expect(valid.included).toBe(true);

    const { included, excluded } = partitionAndSort([zero, valid]);
    expect(included.map(s => s.lot.id)).toEqual(['w5-strong']);
    expect(excluded.map(s => s.lot.id)).toEqual(['w5-zero-price']);
  });

  it('keeps an unsold lot with an estimate out of the credible set, unchanged, with its reason', () => {
    const unsoldWithEstimate: AuctionLot = {
      ...strongLot,
      id: 'w5-unsold-estimate',
      status: 'unsold',
      realizedPrice: undefined,
      estimate: { low: { amount: 3000, currency: 'USD' }, high: { amount: 5000, currency: 'USD' } },
    };

    const { included, excluded } = partitionAndSort([
      scoreComparable(strongLot, paintingItem),
      scoreComparable(unsoldWithEstimate, paintingItem),
    ]);

    // Only the realized sale counts toward the credible set S4 receives.
    expect(included.map(s => s.lot.id)).toEqual(['w5-strong']);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]!.lot.realizedPrice).toBeUndefined();
    expect(excluded[0]!.lot.estimate).toEqual(unsoldWithEstimate.estimate);
    expect(excluded[0]!.exclusionReason).toBe(
      'Not a completed sale (status: unsold) — unsold estimates do not count as realized prices',
    );
  });

  it('gives every candidate either an inclusion matchReason or an exclusionReason', () => {
    const lots: AuctionLot[] = [
      strongLot,
      { ...strongLot, id: 'w5-partial', title: { en: 'Canvas study' }, description: { en: 'Medium unconfirmed.' } },
      { ...strongLot, id: 'w5-weak', title: { en: 'Bronze sculpture' }, description: { en: 'Cast bronze.' } },
      { ...strongLot, id: 'w5-unsold', status: 'unsold', realizedPrice: undefined },
      { ...strongLot, id: 'w5-withdrawn', status: 'withdrawn', realizedPrice: undefined },
      { ...strongLot, id: 'w5-no-price', realizedPrice: undefined },
      { ...strongLot, id: 'w5-zero', realizedPrice: { amount: 0, currency: 'USD' } },
      { ...strongLot, id: 'w5-other-category', category: 'judaica' },
    ];

    const { included, excluded } = partitionAndSort(lots.map(lot => scoreComparable(lot, paintingItem)));

    expect(included.length + excluded.length).toBe(lots.length);
    for (const s of included) {
      expect(s.included).toBe(true);
      expect(s.matchReason).toBeTruthy();
      expect(s.exclusionReason).toBeUndefined();
    }
    for (const s of excluded) {
      expect(s.included).toBe(false);
      expect(s.exclusionReason).toBeTruthy();
    }
  });

  it('produces identical ranked output regardless of input order', () => {
    const lots: AuctionLot[] = [
      { ...strongLot, id: 'w5-order-b', saleDate: '2025-02-01' },
      { ...strongLot, id: 'w5-order-a', saleDate: '2025-02-01' },
      { ...strongLot, id: 'w5-order-newer', saleDate: '2025-05-01' },
      { ...strongLot, id: 'w5-order-partial', title: { en: 'Canvas study' }, description: { en: 'Medium unconfirmed.' } },
      { ...strongLot, id: 'w5-order-unsold', status: 'unsold', realizedPrice: undefined },
    ];
    const rank = (input: AuctionLot[]) => partitionAndSort(input.map(lot => scoreComparable(lot, paintingItem)));

    const forward = rank(lots);
    expect(rank([...lots].reverse())).toEqual(forward);
    expect(rank([...lots.slice(2), ...lots.slice(0, 2)])).toEqual(forward);
    expect(forward.included.map(s => s.lot.id)).toEqual(['w5-order-newer', 'w5-order-a', 'w5-order-b', 'w5-order-partial']);
  });

  it('does not exclude, demote, or alter an extreme realized price — outlier treatment belongs to S4', () => {
    const typical: AuctionLot = { ...strongLot, id: 'w5-typical', realizedPrice: { amount: 1000, currency: 'USD' } };
    const extreme: AuctionLot = { ...strongLot, id: 'w5-extreme', realizedPrice: { amount: 1000000, currency: 'USD' } };

    const { included, excluded } = partitionAndSort([
      scoreComparable(typical, paintingItem),
      scoreComparable(extreme, paintingItem),
    ]);

    expect(excluded).toHaveLength(0);
    expect(included.map(s => s.lot.id)).toEqual(['w5-extreme', 'w5-typical']); // same score and date: id asc
    expect(included[0]!.score).toBe(included[1]!.score);
    expect(included.find(s => s.lot.id === 'w5-extreme')!.lot).toEqual(extreme);
  });
});

describe('scoreComparable format gate', () => {
  const manuscript: AuctionLot = { ...base, id: 'lot-manuscript', medium: 'parchment_manuscript' };
  const scroll: AuctionLot = { ...base, id: 'lot-scroll', medium: 'parchment_scroll' };
  const printed: AuctionLot = { ...base, id: 'lot-printed', medium: 'printed_book' };

  it('values a handwritten item only against manuscripts and scrolls', () => {
    const handwritten = { category: 'rare_books', format: 'handwritten' as const };
    expect(scoreComparable(manuscript, handwritten).included).toBe(true);
    expect(scoreComparable(scroll, handwritten).included).toBe(true);
    const excluded = scoreComparable(printed, handwritten);
    expect(excluded.included).toBe(false);
    expect(excluded.exclusionReason).toContain('Different format');
  });

  it('values a printed item only against printed books', () => {
    const printedItem = { category: 'rare_books', format: 'printed' as const };
    expect(scoreComparable(printed, printedItem).included).toBe(true);
    expect(scoreComparable(manuscript, printedItem).included).toBe(false);
  });

  it('keeps category-only matching when the item format or lot medium is unknown', () => {
    expect(scoreComparable(printed, item).included).toBe(true);
    expect(scoreComparable(base, { category: 'rare_books', format: 'handwritten' }).included).toBe(true);
  });
});
