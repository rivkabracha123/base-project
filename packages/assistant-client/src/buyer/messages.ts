import { z } from 'zod';
import { auctionLotSchema } from '@monabid/shared';

// Schema: defines which message kinds the chat can display, matched on the kind field.
export const buyerMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('buyer'),
    id: z.string().min(1),
    at: z.string().datetime(),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal('assistant'),
    id: z.string().min(1),
    at: z.string().datetime(),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal('error'),
    id: z.string().min(1),
    at: z.string().datetime(),
    code: z.string().min(1),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal('result-group'),
    id: z.string().min(1),
    at: z.string().datetime(),
    title: z.string().min(1),
    lots: z.array(auctionLotSchema),
  }),
]);

// BuyerMessage type — inferred automatically from the schema, for use by TypeScript while writing code.
export type BuyerMessage = z.infer<typeof buyerMessageSchema>;

// parseConversation — checks each entry against the schema and returns only the valid messages; a non-array input yields an empty list.
export function parseConversation(input: unknown): BuyerMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    const result = buyerMessageSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}
