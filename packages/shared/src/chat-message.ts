import { z } from 'zod';

// Fields every chat message shares regardless of speaker or conversation role: an id, the
// session it belongs to, and when it was sent. Concrete per-role schemas (buyer, seller, ...)
// spread these into each message kind instead of redefining the same three fields.
export const baseMessageFields = {
  id: z.string().min(1),
  sessionId: z.string().min(1),
};

// A plain assistant text message — the same shape and meaning in every conversation role
// (the assistant answering in text), so buyer and seller schemas reuse this value as-is.
export const systemMessageSchema = z.object({
  speaker: z.literal('system'),
  ...baseMessageFields,
  text: z.string().min(1),
});

// An error message — text plus a machine-readable code — same shape and meaning in every role.
export const errorMessageSchema = z.object({
  speaker: z.literal('error'),
  ...baseMessageFields,
  code: z.string().min(1),
  text: z.string().min(1),
});
