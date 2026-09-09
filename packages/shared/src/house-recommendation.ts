import { z } from 'zod';

/**
 * Prepared active-house record for S5 ranking.
 * This is a fixture-backed stand-in until P1 publishes canonical house records.
 * Fields are ranking evidence only — not commission, shipping, or acceptance claims.
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

export const rankingItemSchema = z.object({
  category: z.string().min(1),
  geography: z.string().min(1).optional(),
  preferredLanguage: z.string().min(1).optional(),
});

export const rankedHouseSchema = z.object({
  house: preparedAuctionHouseSchema,
  score: z.number().int().nonnegative(),
  reasons: z.array(z.string().min(1)).min(1),
  exclusionReason: z.string().min(1).optional(),
});

export const houseRankingSchema = z.object({
  recommendation: rankedHouseSchema.nullable(),
  alternatives: z.array(rankedHouseSchema),
  excluded: z.array(rankedHouseSchema),
});

export const preparedAuctionHouseFixtureSchema = z.array(preparedAuctionHouseSchema).min(1);

export type PreparedAuctionHouse = z.infer<typeof preparedAuctionHouseSchema>;
export type RankingItem = z.infer<typeof rankingItemSchema>;
export type RankedHouse = z.infer<typeof rankedHouseSchema>;
export type HouseRanking = z.infer<typeof houseRankingSchema>;
