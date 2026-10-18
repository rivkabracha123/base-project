import { z } from 'zod';

/**
 * S5 (Developer 5) shared contracts for “Recommend auction houses and create the seller enquiry.”
 * Week 3: ranking of P1 prepared houses. Week 4: sellerChoice, stored separately from the ranking.
 * These fields are ranking evidence only — not commission, shipping, or acceptance claims.
 */

/**
 * One prepared house from P1’s fixture until P1 publishes canonical house records.
 * S5 may recommend only houses with active: true.
 */
export const preparedAuctionHouseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean(),
  categories: z.array(z.string().min(1)),
  geography: z.string().min(1).optional(),
  languages: z.array(z.string().min(1)),
  recentSaleDate: z.string().date().optional(),
  comparableSoldCountByCategory: z.record(z.string(), z.number().int().nonnegative()),
});

/** S1-shaped item facts S5 uses to rank houses (category is required). */
export const rankingItemSchema = z.object({
  category: z.string().min(1),
  geography: z.string().min(1).optional(),
  preferredLanguage: z.string().min(1).optional(),
});

/** One scored house plus the human-readable reasons S5 shows on the Week 4 screen. */
export const rankedHouseSchema = z.object({
  house: preparedAuctionHouseSchema,
  score: z.number().int().nonnegative(),
  reasons: z.array(z.string().min(1)).min(1),
  exclusionReason: z.string().min(1).optional(),
});

/** S5 ranking payload: one recommendation, alternatives, and excluded (inactive) houses. */
export const houseRankingSchema = z.object({
  recommendation: rankedHouseSchema.nullable(),
  alternatives: z.array(rankedHouseSchema),
  excluded: z.array(rankedHouseSchema),
});

export const preparedAuctionHouseFixtureSchema = z.array(preparedAuctionHouseSchema).min(1);

/**
 * S5 Week 4 typed contract: the seller’s house pick.
 * source is always "seller" so P5 can tell this apart from S5’s ranked recommendation.
 * Saving this must not overwrite HouseRanking on the lead.
 */
export const sellerChoiceSchema = z.object({
  houseId: z.string().min(1),
  houseName: z.string().min(1),
  source: z.literal('seller'),
});

/** S1 bilingual catalog draft S5 reviews and stores on the final lead. */
export const catalogDraftSchema = z.object({
  he: z.string().min(1),
  en: z.string().min(1),
});

/** S1 confirmed item facts S5 copies onto the lead for P5 (S5 does not rewrite facts). */
export const sellerLeadItemSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
});

/** S2 evidence IDs/types only — S5 does not store files. */
export const sellerLeadEvidenceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
});

const dashboardSourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url().nullable(),
});

const dashboardValuationComparableSchema = z.object({
  id: z.string().min(1),
  source: dashboardSourceSchema,
  saleDate: z.string().date().optional(),
});

const dashboardExcludedComparableSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
});

const dashboardValuationConfidenceSchema = z.object({
  level: z.enum(['low', 'medium', 'high']),
  explanation: z.string().min(1),
});

const dashboardValuationSharedFields = {
  reportId: z.string().min(1),
  comparableCount: z.number().int().nonnegative(),
  limitations: z.array(z.string().min(1)).min(1),
  comparables: z.array(dashboardValuationComparableSchema),
  excludedComparables: z.array(dashboardExcludedComparableSchema),
};

/**
 * S5 copy stored on the lead and returned to P5. S4's canonical DashboardValuationDto
 * is `dashboardValuationSchema` in dashboard-valuation.ts (HTTPS sources, sale dates).
 * S5 does not recalculate. Unverified sources use label "Source unavailable" and url: null.
 * Refusal may omit confidence to match S4's dashboard projection.
 */
export const sellerLeadValuationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('supported'),
    ...dashboardValuationSharedFields,
    confidence: dashboardValuationConfidenceSchema,
    valuationRange: z.object({
      min: z.number(),
      max: z.number(),
      currency: z.literal('USD'),
    }),
  }),
  z.object({
    status: z.literal('refusal'),
    ...dashboardValuationSharedFields,
    confidence: dashboardValuationConfidenceSchema.optional(),
    reason: z.string().min(1),
  }),
]);

export const sellerLeadStatusSchema = z.enum(['draft', 'submitted']);

export const sellerLeadHistoryEventSchema = z.object({
  at: z.string().datetime(),
  event: z.enum(['drafted', 'ranked', 'chose_house', 'submitted']),
  actor: z.enum(['system', 'seller']),
});

/**
 * S5 Week 5: complete internal SellerLead for P5.
 * status "submitted" means the seller finished catalog review; it is not a house contact.
 */
export const sellerLeadSummarySchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  contact: z.object({
    preferredName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
  }),
  recommendation: houseRankingSchema.nullable(),
  sellerChoice: sellerChoiceSchema.nullable(),
  catalogDraft: catalogDraftSchema.nullable(),
  item: sellerLeadItemSchema.nullable(),
  evidence: z.array(sellerLeadEvidenceSchema).nullable(),
  valuation: sellerLeadValuationSchema.nullable(),
  status: sellerLeadStatusSchema,
  history: z.array(sellerLeadHistoryEventSchema),
  createdAt: z.string().datetime(),
});

/** Public comparable id/source only — never a file path, signed URL, or raw lot dump. */
export const sellerLeadComparableRefSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1).optional(),
});

export const submitSellerLeadSchema = z.object({
  catalogDraft: catalogDraftSchema,
  item: sellerLeadItemSchema,
  evidence: z.array(sellerLeadEvidenceSchema).min(1),
  valuation: sellerLeadValuationSchema,
  comparables: z.array(sellerLeadComparableRefSchema).optional(),
});

/**
 * S5 → P5 dashboard detail. P5 must call GET /api/seller-leads/:leadId and must not
 * read seller or valuation tables. This shape omits profileId, sessionId,
 * marketingConsent, conversation, file paths, signed URLs, and raw private evidence.
 */
export const sellerLeadDashboardDetailSchema = z.object({
  leadId: z.string().uuid(),
  status: sellerLeadStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  item: sellerLeadItemSchema.nullable(),
  evidence: z.array(sellerLeadEvidenceSchema),
  comparables: z.array(sellerLeadComparableRefSchema),
  valuation: sellerLeadValuationSchema.nullable(),
  recommendation: rankedHouseSchema.nullable(),
  alternatives: z.array(rankedHouseSchema),
  sellerChoice: sellerChoiceSchema.nullable(),
  catalogDraft: catalogDraftSchema.nullable(),
  contact: z
    .object({
      preferredName: z.string().min(1).nullable(),
      email: z.string().email().nullable(),
      phone: z.string().min(1).nullable(),
      serviceConsentGranted: z.boolean(),
    })
    .superRefine((contact, ctx) => {
      if (contact.serviceConsentGranted === false) {
        if (contact.email !== null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'email must be null when serviceConsentGranted is false' });
        }
        if (contact.phone !== null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'phone must be null when serviceConsentGranted is false' });
        }
      }
    }),
  history: z.array(sellerLeadHistoryEventSchema),
});

export type PreparedAuctionHouse = z.infer<typeof preparedAuctionHouseSchema>;
export type RankingItem = z.infer<typeof rankingItemSchema>;
export type RankedHouse = z.infer<typeof rankedHouseSchema>;
export type HouseRanking = z.infer<typeof houseRankingSchema>;
export type SellerChoice = z.infer<typeof sellerChoiceSchema>;
export type CatalogDraft = z.infer<typeof catalogDraftSchema>;
export type SellerLeadItem = z.infer<typeof sellerLeadItemSchema>;
export type SellerLeadEvidence = z.infer<typeof sellerLeadEvidenceSchema>;
export type DashboardValuation = z.infer<typeof sellerLeadValuationSchema>;
export type SellerLeadValuation = DashboardValuation;
export type SellerLeadStatus = z.infer<typeof sellerLeadStatusSchema>;
export type SellerLeadHistoryEvent = z.infer<typeof sellerLeadHistoryEventSchema>;
export type SellerLeadSummary = z.infer<typeof sellerLeadSummarySchema>;
export type SubmitSellerLead = z.infer<typeof submitSellerLeadSchema>;
export type SellerLeadComparableRef = z.infer<typeof sellerLeadComparableRefSchema>;
export type SellerLeadDashboardDetail = z.infer<typeof sellerLeadDashboardDetailSchema>;
