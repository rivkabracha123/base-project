import type { ZodType } from 'zod';

// parseConversationWith — checks each entry against the given message schema and returns only the valid messages;
// a non-array input yields an empty list. Shared by every conversation role (buyer, seller), each with its own schema.
export function parseConversationWith<TMessage>(schema: ZodType<TMessage>, input: unknown): TMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    const result = schema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}
