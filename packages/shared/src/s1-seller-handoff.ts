import { z } from 'zod';
import { sellerItemSchema, type SellerItem } from './comparable';
import {
  rankingItemSchema,
  submitSellerLeadSchema,
  type RankingItem,
  type SubmitSellerLead,
} from './house-recommendation';

/**
 * Consumed by seller enquiry (GET ranking / final lead).
 * Copies confirmed item facts, catalog draft, and evidence ids only.
 * Does not copy seller contact, uncertain facts, file URIs, or valuation.
 */
export const confirmedItemDraftSchema = z
  .object({
    language: z
      .object({
        preferred: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
    item: z
      .object({
        id: z.string().min(1),
        category: z.string().min(1),
        title: z.string().min(1),
        evidenceIds: z.array(z.string().min(1)).default([]),
        catalogDraft: z.object({
          he: z.string(),
          en: z.string(),
        }),
      })
      .passthrough(),
    evidence: z
      .array(
        z
          .object({
            id: z.string().min(1),
            type: z.string().min(1),
          })
          .passthrough(),
      )
      .default([]),
    confirmedFacts: z
      .object({
        category: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ConfirmedItemDraft = z.infer<typeof confirmedItemDraftSchema>;

export const s1DemoIntakeInput = 'I have a painting and want to confirm details.';

export const defaultRankingItem: RankingItem = rankingItemSchema.parse({
  category: 'rare_books',
  geography: 'United States',
  preferredLanguage: 'en',
});

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((row): row is string => typeof row === 'string' && row.trim().length > 0);
  return items.length ? items : undefined;
}

/** S3 query shape from an S1 confirmed draft. S5 does not score comparables. */
export function sellerItemFromS1Draft(payload: unknown): SellerItem {
  const draft = confirmedItemDraftSchema.parse(payload);
  const facts = draft.confirmedFacts as { category?: string; materials?: unknown } | undefined;
  const item = draft.item as { category: string; materials?: unknown };
  const materials = stringList(facts?.materials) ?? stringList(item.materials);
  return sellerItemSchema.parse({
    category: facts?.category?.trim() || item.category,
    ...(materials ? { materials } : {}),
  });
}

/** Stable S4 itemVersion from S1 timestamps/revisions — S5 does not invent versions. */
export function itemVersionFromS1Draft(payload: unknown): string {
  const draft = confirmedItemDraftSchema.parse(payload) as {
    updatedAt?: unknown;
    revisionHistory?: Array<{ revisionId?: unknown }>;
  };
  if (typeof draft.updatedAt === 'string' && draft.updatedAt.trim()) return draft.updatedAt.trim();
  const revisionId = draft.revisionHistory?.at(-1)?.revisionId;
  if (typeof revisionId === 'string' && revisionId.trim()) return revisionId.trim();
  return 'confirmed';
}
export function rankingItemFromS1Draft(
  draft: ConfirmedItemDraft | null | undefined,
  fallback: RankingItem = defaultRankingItem,
): RankingItem {
  const category = draft?.confirmedFacts?.category?.trim() || draft?.item.category.trim();
  if (!category) return fallback;

  const preferredLanguage = draft?.language?.preferred?.trim();
  return rankingItemSchema.parse({
    category,
    ...(preferredLanguage ? { preferredLanguage } : {}),
  });
}

export function leadHandoffFromS1Draft(
  draft: ConfirmedItemDraft,
  valuation: SubmitSellerLead['valuation'],
): SubmitSellerLead {
  const evidenceById = new Map(draft.evidence.map((row) => [row.id, row]));
  const ids = draft.item.evidenceIds.length
    ? draft.item.evidenceIds
    : draft.evidence.map((row) => row.id);
  const evidence = ids.map((id) => ({
    id,
    type: evidenceById.get(id)?.type ?? 'seller_statement',
  }));

  return submitSellerLeadSchema.parse({
    catalogDraft: draft.item.catalogDraft,
    item: {
      id: draft.item.id,
      category: draft.confirmedFacts?.category?.trim() || draft.item.category,
      title: draft.item.title,
      evidenceIds: ids,
    },
    evidence,
    valuation,
  });
}

/**
 * Confirmed intake draft in; catalog, item, evidence ids, and ranking input out.
 * HTTP request/response, not a webhook.
 */
export function receiveConfirmedItemHandoff(payload: unknown): {
  rankingItem: RankingItem;
  catalogDraft: { he: string; en: string };
  item: {
    id: string;
    category: string;
    title: string;
    evidenceIds: string[];
  };
  evidence: Array<{ id: string; type: string }>;
} {
  const draft = confirmedItemDraftSchema.parse(payload);
  const ids = draft.item.evidenceIds.length
    ? draft.item.evidenceIds
    : draft.evidence.map((row) => row.id);
  const evidenceById = new Map(draft.evidence.map((row) => [row.id, row]));

  return {
    rankingItem: rankingItemFromS1Draft(draft),
    catalogDraft: draft.item.catalogDraft,
    item: {
      id: draft.item.id,
      category: draft.confirmedFacts?.category?.trim() || draft.item.category,
      title: draft.item.title,
      evidenceIds: ids,
    },
    evidence: ids.map((id) => ({
      id,
      type: evidenceById.get(id)?.type ?? 'seller_statement',
    })),
  };
}
