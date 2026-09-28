// Sample data for handoff/manual QA of ComparableEvidencePanel (components/ComparableEvidencePanel.tsx).
// Not exported from ../index.ts — the panel itself takes real ComparableEvidence as a prop; this
// file only supplies illustrative values shaped exactly like the real ScoredComparable/AuctionLot
// contract (packages/shared/src/comparable.ts) so the panel can be previewed without a live backend.
import type { ComparableEvidence } from '@monabid/shared';
import type { ComparableSalesLabels } from '../components/ComparableEvidencePanel';

export const sampleComparableSalesLabels: ComparableSalesLabels = {
  includedHeading: 'Sales counted as evidence',
  excludedHeading: 'Found, but not counted',
  excludedNote: 'Shown for transparency only. These results do not support the valuation below.',
  estimate: 'Estimate',
  realized: 'Realized price',
  whyIncluded: 'Why this counts',
  whyExcluded: "Why it wasn't counted",
  noImage: 'No image on file',
  status: {
    sold: 'Sold',
    unsold: 'Unsold',
    upcoming: 'Upcoming',
    withdrawn: 'Withdrawn',
    unknown: 'Status unknown',
  },
};

export const sampleComparableEvidence: ComparableEvidence = {
  included: [
    {
      lot: {
        id: 'lot-kestenbaum-54554-121421',
        source: {
          provider: 'bidspirit-snapshot',
          recordId: 'kestenbaum-54554-121421',
          url: 'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
          retrievedAt: '2025-08-21T00:00:00.000Z',
        },
        auctionHouse: { id: 'house-kestenbaum', name: 'Kestenbaum & Company' },
        auctionTitle: 'Rare Hebrew Printed Books, Manuscripts & Important American Judaica',
        lotNumber: '1',
        title: { en: 'Atereth Zekeinim by Yitzhak Abrabanel', he: 'עטרת זקנים מאת יצחק אברבנאל' },
        description: { en: 'A rare Hebrew printed philosophy volume.', he: 'ספר פילוסופיה עברי נדיר.' },
        category: 'rare_books',
        saleDate: '2025-01-23',
        status: 'sold',
        estimate: { low: { amount: 800, currency: 'USD' }, high: { amount: 1200, currency: 'USD' } },
        realizedPrice: { amount: 1200, currency: 'USD' },
      },
      score: 1,
      included: true,
      matchReason: "Same category 'rare_books', completed sale with realized price",
    },
  ],
  excluded: [
    {
      lot: {
        id: 'lot-df-10552-02',
        source: {
          provider: 'bidspirit-snapshot',
          recordId: 'dorotheum-10552-02',
          url: 'https://example.com/lot/10552-02',
          retrievedAt: '2025-08-21T00:00:00.000Z',
        },
        auctionHouse: { id: 'house-dorotheum-fine', name: 'Dorotheum Fine Books' },
        auctionTitle: 'Continental Paintings',
        lotNumber: '2',
        title: { en: '19th-Century Oil Painting, Continental School, Pastoral Landscape' },
        description: { en: 'An oil painting on canvas.' },
        category: 'fine_art',
        saleDate: '2025-01-30',
        status: 'sold',
        estimate: { low: { amount: 900, currency: 'EUR' }, high: { amount: 1400, currency: 'EUR' } },
        realizedPrice: { amount: 1350, currency: 'EUR' },
      },
      score: 0,
      included: false,
      matchReason: "Different category ('fine_art' vs 'rare_books')",
      exclusionReason: "Category does not match — 'fine_art' is not 'rare_books'",
    },
  ],
};
