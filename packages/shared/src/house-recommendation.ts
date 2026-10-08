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

export type PreparedAuctionHouse = z.infer<typeof preparedAuctionHouseSchema>;
export type RankingItem = z.infer<typeof rankingItemSchema>;
export type RankedHouse = z.infer<typeof rankedHouseSchema>;
export type HouseRanking = z.infer<typeof houseRankingSchema>;
export type SellerChoice = z.infer<typeof sellerChoiceSchema>;
