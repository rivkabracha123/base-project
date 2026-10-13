import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSellerEnquiryListeners,
  emitSellerEnquiryEvent,
  listenToSellerEnquiry,
  runSellerEnquiry,
  runSellerEnquiryFromConfirmedDraft,
} from './seller-enquiry-events';

afterEach(() => {
  clearSellerEnquiryListeners();
});

describe('seller enquiry events the intake conversation listens to', () => {
  it('calls the listener when a house ranking is emitted', () => {
    const heard: string[] = [];
    const stop = listenToSellerEnquiry((event) => heard.push(event.kind));

    emitSellerEnquiryEvent({
      kind: 'house_ranking',
      ranking: { recommendation: null, alternatives: [], excluded: [] },
    });

    expect(heard).toContain('house_ranking');
    stop();
  });

  it('notifies catalog_review from a confirmed draft without leaking contact', () => {
    const heard: unknown[] = [];
    const stop = listenToSellerEnquiry((event) => heard.push(event));

    const copied = runSellerEnquiryFromConfirmedDraft({
      item: {
        id: 'item-001',
        category: 'paintings',
        title: 'Abstract landscape study',
        evidenceIds: ['evidence-001'],
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
      seller: { preferredName: 'Maya' },
    });

    expect(copied.item.title).toBe('Abstract landscape study');
    expect(heard).toEqual([
      expect.objectContaining({ kind: 'catalog_review', catalogDraft: copied.catalogDraft }),
    ]);
    expect(JSON.stringify(heard)).not.toMatch(/Maya/);
    stop();
  });

  it('calls onComplete once with the result when seller enquiry finishes', async () => {
    const draft = {
      item: {
        id: 'item-001',
        category: 'paintings',
        title: 'Abstract landscape study',
        evidenceIds: ['evidence-001'],
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
    };

    const result = await new Promise((resolve, reject) => {
      runSellerEnquiry(draft, resolve, reject);
    });

    expect(result).toMatchObject({
      rankingItem: { category: 'paintings' },
      catalogDraft: { en: 'Abstract landscape study' },
      item: { id: 'item-001', title: 'Abstract landscape study' },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
    });
  });
});
