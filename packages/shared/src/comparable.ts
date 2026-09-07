import { z } from 'zod';
import { auctionLotSchema } from './auction-lot';

export const sellerItemSchema = z.object({
  category: z.string().min(1),
});

export const scoredComparableSchema = z.object({
  lot: auctionLotSchema,
  score: z.number().min(0).max(1),
  included: z.boolean(),
  matchReason: z.string(),
  exclusionReason: z.string().optional(),
});

export const comparableEvidenceSchema = z.object({
  included: z.array(scoredComparableSchema),
  excluded: z.array(scoredComparableSchema),
});

export type SellerItem = z.infer<typeof sellerItemSchema>;
export type ScoredComparable = z.infer<typeof scoredComparableSchema>;
export type ComparableEvidence = z.infer<typeof comparableEvidenceSchema>;
