import { z } from 'zod';
import { baseMessageFields, errorMessageSchema, systemMessageSchema } from '@monabid/shared';
import { parseConversationWith } from '../chat/parse-conversation';

// A photo the seller attached, by reference — the same shape the evidence API returns (EvidenceReference in app/api.ts).
// The message stores the reference, not the picture; the picture URL is built from previewUri when displayed.
const sellerImageSchema = z.object({
  fileId: z.string().min(1),
  profileId: z.string().min(1),
  itemId: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().nonnegative(),
  previewUri: z.string().min(1),
  downloadUri: z.string().min(1),
});

// Schema: defines which message kinds the seller chat can display, matched on the speaker field.
// 'system' and 'error' are the shared shapes from @monabid/shared; 'seller' is seller-only.
// Seller-specific message kinds (fact review, photo requests, etc.) are added here as the
// seller conversation flow is built — this is a minimal starting contract, not the full flow.
export const sellerMessageSchema = z.discriminatedUnion('speaker', [
  z.object({
    speaker: z.literal('seller'),
    ...baseMessageFields,
    text: z.string().min(1).optional(),
    image: sellerImageSchema.optional(),
  }),
  systemMessageSchema,
  errorMessageSchema,
]).refine(
  // A seller message must carry text, a photo, or both; system and error messages always have text.
  (message) => message.speaker !== 'seller' || message.text !== undefined || message.image !== undefined,
  { message: 'A seller message needs text or an image' },
);

// SellerMessage type — inferred automatically from the schema, for use by TypeScript while writing code.
export type SellerMessage = z.infer<typeof sellerMessageSchema>;


// parseConversation — checks each entry against the seller schema and returns only the valid messages; a non-array input yields an empty list.
export function parseConversation(input: unknown): SellerMessage[] {
  return parseConversationWith(sellerMessageSchema, input);
}
