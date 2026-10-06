import { z } from 'zod';
import {
  catalogDraftSchema,
  houseRankingSchema,
  sellerChoiceSchema,
  sellerLeadEvidenceSchema,
  sellerLeadItemSchema,
  type CatalogDraft,
  type RankingItem,
  type SellerLeadEvidence,
  type SellerLeadItem,
} from './house-recommendation';
import { receiveConfirmedItemHandoff } from './s1-seller-handoff';

/**
 * Seller-enquiry events the intake conversation listens to.
 * Register with listenToSellerEnquiry(callback). Not a webhook.
 */
export const sellerEnquiryEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('house_ranking'),
    ranking: houseRankingSchema,
    catalogDraft: catalogDraftSchema.optional(),
    item: sellerLeadItemSchema.optional(),
    evidence: z.array(sellerLeadEvidenceSchema).optional(),
  }),
  z.object({
    kind: z.literal('catalog_review'),
    catalogDraft: catalogDraftSchema,
    item: sellerLeadItemSchema,
    evidence: z.array(sellerLeadEvidenceSchema),
  }),
  z.object({
    kind: z.literal('seller_choice'),
    choice: sellerChoiceSchema,
  }),
  z.object({
    kind: z.literal('internal_enquiry'),
    houseName: z.string().min(1),
  }),
]);

export type SellerEnquiryEvent = z.infer<typeof sellerEnquiryEventSchema>;
export type SellerEnquiryListener = (event: SellerEnquiryEvent) => void;

const listeners = new Set<SellerEnquiryListener>();

/** Intake: register to hear house ranking, catalog review, seller choice, and internal enquiry. */
export function listenToSellerEnquiry(listener: SellerEnquiryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearSellerEnquiryListeners(): void {
  listeners.clear();
}

export function emitSellerEnquiryEvent(event: SellerEnquiryEvent): void {
  const parsed = sellerEnquiryEventSchema.parse(event);
  for (const listener of listeners) listener(parsed);
}

export type SellerEnquiryResult = {
  rankingItem: RankingItem;
  catalogDraft: CatalogDraft;
  item: SellerLeadItem;
  evidence: SellerLeadEvidence[];
};

/** Called once when seller-enquiry work finishes. Use this to continue the seller flow. */
export type SellerEnquiryOnComplete = (result: SellerEnquiryResult) => void;

/**
 * Invoke seller enquiry. When it finishes, onComplete receives the result to continue with.
 * listenToSellerEnquiry is optional UI pub/sub; this is the completion callback.
 */
export function runSellerEnquiry(
  payload: unknown,
  onComplete: SellerEnquiryOnComplete,
  onError?: (error: Error) => void,
): void {
  queueMicrotask(() => {
    try {
      const result = receiveConfirmedItemHandoff(payload);
      emitSellerEnquiryEvent({
        kind: 'catalog_review',
        catalogDraft: result.catalogDraft,
        item: result.item,
        evidence: result.evidence,
      });
      onComplete(result);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * @deprecated Prefer runSellerEnquiry(payload, onComplete). This still returns immediately
 * and also notifies listeners; it does not mean the ranking HTTP call has finished.
 */
export function runSellerEnquiryFromConfirmedDraft(
  payload: unknown,
  onEvent?: SellerEnquiryListener,
): SellerEnquiryResult {
  const copied = receiveConfirmedItemHandoff(payload);
  const event: SellerEnquiryEvent = {
    kind: 'catalog_review',
    catalogDraft: copied.catalogDraft,
    item: copied.item,
    evidence: copied.evidence,
  };
  emitSellerEnquiryEvent(event);
  onEvent?.(event);
  return copied;
}
