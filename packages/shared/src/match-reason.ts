import { z } from 'zod';

// Why a lot matched a search: which part of the request it matched, and the value
// as the caller sent it. Shared so the backend and the client use one definition.
// Reported in this order: `query` first, then the list filters, then dateRange and price.
export const MATCH_REASON_FIELDS = [
  'query',
  'keywords',
  'categories',
  'creators',
  'auctionHouseIds',
  'geography',
  'media',
  'statuses',
  'periods',
  'dateRange',
  'price',
] as const;

export type MatchReasonField = (typeof MATCH_REASON_FIELDS)[number];

export const matchReasonSchema = z.object({
  field: z.enum(MATCH_REASON_FIELDS),
  detail: z.string(),
});

export type MatchReason = z.infer<typeof matchReasonSchema>;
