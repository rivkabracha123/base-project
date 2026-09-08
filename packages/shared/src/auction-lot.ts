import { z } from 'zod';

// Canonical money and lot shape used across backend and frontend.
// Keeps IDs, source lineage, and money values strict and traceable before data reaches consumers.
export const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

const canonicalTokenSchema = z.string().min(1).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

export const auctionLotSchema = z.object({
  id: z.string().min(1),
  source: z.object({
    provider: z.string().min(1),
    recordId: z.string().min(1),
    url: z.string().url(),
    retrievedAt: z.string().datetime(),
  }),
  auctionHouse: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  auctionTitle: z.string().min(1),
  lotNumber: z.string().min(1),
  title: z.object({
    en: z.string().min(1),
    he: z.string().min(1).optional(),
  }),
  description: z.object({
    en: z.string(),
    he: z.string().optional(),
  }),
  category: z.string().min(1),
  itemKey: canonicalTokenSchema.optional(),
  creator: canonicalTokenSchema.optional(),
  period: canonicalTokenSchema.optional(),
  medium: canonicalTokenSchema.optional(),
  geography: canonicalTokenSchema.optional(),
  saleDate: z.string().date(),
  status: z.enum(['sold', 'unsold', 'upcoming', 'withdrawn', 'unknown']),
  estimate: z.object({ low: moneySchema, high: moneySchema }).optional(),
  realizedPrice: moneySchema.optional(),
  imageUrl: z.string().url().optional(),
});

// Fixture batch contract: a valid file must contain at least one canonical lot.
// Rejects incomplete records, invalid money values, and broken source metadata.
export const auctionLotFixtureSchema = z.array(auctionLotSchema).min(1);

export type Money = z.infer<typeof moneySchema>;
export type AuctionLot = z.infer<typeof auctionLotSchema>;
