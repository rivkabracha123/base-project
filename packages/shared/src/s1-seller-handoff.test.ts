import { describe, expect, it } from 'vitest';
import {
  leadHandoffFromS1Draft,
  rankingItemFromS1Draft,
  confirmedItemDraftSchema,
  defaultRankingItem,
  itemVersionFromS1Draft,
  receiveConfirmedItemHandoff,
  sellerItemFromS1Draft,
} from './s1-seller-handoff';

const valuation = {
  status: 'supported' as const,
  reportId: 'valuation-001',
  comparableCount: 1,
  confidence: {
    level: 'low' as const,
    explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
  },
  limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
  comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
  excludedComparables: [],
  valuationRange: { min: 800, max: 1200, currency: 'USD' as const },
};

const efratDraft = {
  language: { preferred: 'he' },
  item: {
    id: 'item-001',
    category: 'paintings',
    title: 'Abstract landscape study',
    evidenceIds: ['evidence-001'],
    catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
  },
  evidence: [
    {
      id: 'evidence-001',
      type: 'seller_statement',
      uri: 'file:///secret.jpg',
      previewUri: '/uploads/secret.jpg',
    },
  ],
  confirmedFacts: { category: 'paintings' },
  uncertainFacts: [{ field: 'era', status: 'uncertain', value: '1980s' }],
  seller: { preferredName: 'Maya', name: 'Maya Cohen' },
};

describe('confirmed item draft consumer for seller enquiry', () => {
  it('ranks from confirmed category and preferred language', () => {
    const draft = confirmedItemDraftSchema.parse(efratDraft);
    expect(rankingItemFromS1Draft(draft)).toEqual({
      category: 'paintings',
      preferredLanguage: 'he',
    });
  });

  it('falls back when S1 is missing', () => {
    expect(rankingItemFromS1Draft(null)).toEqual(defaultRankingItem);
  });

  it('does not hand corrected but unconfirmed category or materials to downstream consumers', () => {
    const correctedButUnconfirmedDraft = {
      ...efratDraft,
      item: {
        ...efratDraft.item,
        category: 'rings',
        materials: ['gold'],
        catalogDraft: { he: 'קטגוריה לא אושרה', en: 'Category not confirmed' },
      },
      confirmedFacts: {},
    };
    const draft = confirmedItemDraftSchema.parse(correctedButUnconfirmedDraft);

    expect(sellerItemFromS1Draft(draft)).toEqual({ category: 'unknown' });
    expect(rankingItemFromS1Draft(draft).category).toBe('unknown');
    expect(leadHandoffFromS1Draft(draft, valuation).item.category).toBe('unknown');
    expect(receiveConfirmedItemHandoff(draft).item.category).toBe('unknown');
  });

  it('keeps legacy item-category fallback only when no confirmation contract is present', () => {
    const { confirmedFacts: _confirmedFacts, ...legacyDraft } = efratDraft;

    expect(sellerItemFromS1Draft(legacyDraft).category).toBe('paintings');
  });

  it('copies catalog, item, and evidence ids without URIs, contact, or uncertain facts', () => {
    const handoff = leadHandoffFromS1Draft(confirmedItemDraftSchema.parse(efratDraft), valuation);
    expect(handoff.catalogDraft).toEqual(efratDraft.item.catalogDraft);
    expect(handoff.item).toEqual({
      id: 'item-001',
      category: 'paintings',
      title: 'Abstract landscape study',
      evidenceIds: ['evidence-001'],
    });
    expect(handoff.evidence).toEqual([{ id: 'evidence-001', type: 'seller_statement' }]);
    expect(JSON.stringify(handoff)).not.toMatch(/file:|previewUri|Maya|1980s|uncertain/i);
  });

  it('accepts S1 callback payload and strips URIs and contact', () => {
    const received = receiveConfirmedItemHandoff(efratDraft);
    expect(received.rankingItem.category).toBe('paintings');
    expect(received.catalogDraft.en).toBe('Abstract landscape study');
    expect(received.evidence).toEqual([{ id: 'evidence-001', type: 'seller_statement' }]);
    expect(JSON.stringify(received)).not.toMatch(/file:|previewUri|Maya/i);
  });

  it('builds the S3 seller item from confirmed category and materials', () => {
    expect(
      sellerItemFromS1Draft({
        ...efratDraft,
        item: { ...efratDraft.item, materials: ['oil', 'canvas'] },
        confirmedFacts: { ...efratDraft.confirmedFacts, materials: ['oil', 'canvas'] },
      }),
    ).toEqual({ category: 'paintings', materials: ['oil', 'canvas'] });
    expect(itemVersionFromS1Draft({ ...efratDraft, updatedAt: '2026-09-01T10:00:00.000Z' })).toBe(
      '2026-09-01T10:00:00.000Z',
    );
    expect(itemVersionFromS1Draft({
      ...efratDraft,
      revisionHistory: [{ revisionId: 'revision-1' }, { revisionId: 'revision-2' }],
    })).toBe('revision-2');
  });
});
