import { z } from 'zod';
import { baseMessageFields, errorMessageSchema, systemMessageSchema } from '@monabid/shared';
import { parseConversationWith } from '../chat/parse-conversation';

// Schema: defines which message kinds the seller chat can display, matched on the speaker field.
// 'system' and 'error' are the shared shapes from @monabid/shared; 'seller' is seller-only.
// Seller-specific message kinds (fact review, photo requests, etc.) are added here as the
// seller conversation flow is built — this is a minimal starting contract, not the full flow.
export const sellerMessageSchema = z.discriminatedUnion('speaker', [
  z.object({
    speaker: z.literal('seller'),
    ...baseMessageFields,
    text: z.string().min(1),
  }),
  systemMessageSchema,
  errorMessageSchema,
]);

// SellerMessage type — inferred automatically from the schema, for use by TypeScript while writing code.
export type SellerMessage = z.infer<typeof sellerMessageSchema>;


// parseConversation — checks each entry against the seller schema and returns only the valid messages; a non-array input yields an empty list.
export function parseConversation(input: unknown): SellerMessage[] {
  return parseConversationWith(sellerMessageSchema, input);
}
