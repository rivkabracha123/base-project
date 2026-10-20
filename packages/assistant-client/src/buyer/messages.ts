import { z } from 'zod';
import { auctionLotSchema, houseRankingSchema, baseMessageFields, errorMessageSchema, systemMessageSchema } from '@monabid/shared';
import { parseConversationWith } from '../chat/parse-conversation';

// Schema: defines which message kinds the chat can display, matched on the speaker field.
// Field names (speaker, sessionId, skipped) follow the contract agreed with B2.
// 'system' and 'error' are the shared shapes from @monabid/shared; the rest are buyer-only.
export const buyerMessageSchema = z.discriminatedUnion('speaker', [
  z.object({
    speaker: z.literal('buyer'),
    ...baseMessageFields,
    skipped: z.literal(false),
    text: z.string().min(1),
  }),
  systemMessageSchema,
  z.object({ speaker: z.literal('house-ranking'), ...baseMessageFields,
    ranking: houseRankingSchema, category: z.string().min(1) }),
  z.object({ speaker: z.literal('sale-history'), ...baseMessageFields,
    title: z.string().min(1), lots: z.array(auctionLotSchema) }),
  errorMessageSchema,
  z.object({
    speaker: z.literal('no-results'),
    ...baseMessageFields,
    text: z.string().min(1),
  }),
  z.object({
    speaker: z.literal('results-found'),
    ...baseMessageFields,
    text: z.string().min(1),
  }),
  // Result cards from B4: lots is the AuctionLot[] B4 returns, per the shared auctionLotSchema contract.
  z.object({
    speaker: z.literal('result-group'),
    ...baseMessageFields,
    // כותרת הקבוצה, כפי שהשרת קובע אותה (למשל "מכירות קרובות"); אופציונלית כדי ששיחות בלי כותרת ימשיכו להיקרא.
    title: z.string().min(1).optional(),
    evidenceLotIds: z.array(z.string().min(1)).optional(),
    lots: z.array(auctionLotSchema),
    // Set by the server on the "similar items in other categories" follow-up; those lots get the card that shows the category.
    variant: z.literal('other-categories').optional(),
    // Why each lot matched, by lot id, exactly as the search reported it; absent when the server sent none.
    matchReasons: z
      .record(z.string(), z.array(z.object({ field: z.string().min(1), detail: z.string() })))
      .optional(),
  }),
  z.object({
    speaker: z.literal('price-trend'),
    ...baseMessageFields,
    title: z.string().min(1),
    lots: z.array(auctionLotSchema),
    points: z.array(z.object({
      lotId: z.string().min(1),
      saleDate: z.string().min(1),
      title: z.string().min(1),
      price: z.object({ amount: z.number(), currency: z.string().min(1) }),
    })),
  }),
]);

// BuyerMessage type — inferred automatically from the schema, for use by TypeScript while writing code.
export type BuyerMessage = z.infer<typeof buyerMessageSchema>;

// parseConversation — checks each entry against the schema and returns only the valid messages; a non-array input yields an empty list.
export function parseConversation(input: unknown): BuyerMessage[] {
  return parseConversationWith(buyerMessageSchema, input);
}
