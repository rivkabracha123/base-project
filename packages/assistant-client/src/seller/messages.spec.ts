import { describe, it, expect } from 'vitest';
import { parseConversation } from './messages';
import { mockConversation } from './mock-conversation';

// Tests for seller parseConversation — mirrors buyer/messages.spec.ts for the seller schema.
describe('seller parseConversation', () => {
  // Positive: a valid seller message is kept as-is.
  it('keeps a valid seller message', () => {
    const input = [
      { speaker: 'seller', id: 'm1', sessionId: 's1', text: 'שלום' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a message with an unrecognised speaker is dropped and an empty list is returned.
  it('drops a message whose speaker is not recognised', () => {
    const input = [
      { speaker: 'banana', id: 'm2', sessionId: 's1', text: 'x' },
    ];
    expect(parseConversation(input)).toEqual([]);
  });

  // Positive: a valid system message (the shared shape) is kept as-is.
  it('keeps a valid system message', () => {
    const input = [
      { speaker: 'system', id: 'm3', sessionId: 's1', text: 'תוכל/י להעלות תמונה?' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid error message (the shared shape) is kept; it has a code field in addition to text.
  it('keeps a valid error message', () => {
    const input = [
      { speaker: 'error', id: 'm4', sessionId: 's1', code: 'save_failed', text: 'שמירה נכשלה.' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a seller message missing the text field is dropped.
  it('drops a message that is missing a required field', () => {
    const input = [{ speaker: 'seller', id: 'm5', sessionId: 's1' }];
    expect(parseConversation(input)).toEqual([]);
  });

  // Negative: a non-array input returns an empty list instead of crashing.
  it('returns an empty list when the input is not an array', () => {
    expect(parseConversation('not an array')).toEqual([]);
    expect(parseConversation(null)).toEqual([]);
    expect(parseConversation({ speaker: 'seller' })).toEqual([]);
  });

  // Mixed: from a list of valid and invalid entries, only the valid ones are kept, in the same order.
  it('keeps only the valid messages from a mixed list', () => {
    const valid = { speaker: 'seller', id: 'm6', sessionId: 's1', text: 'שלום' };
    const input = [
      valid,
      { speaker: 'banana', id: 'm7', sessionId: 's1' },
      { speaker: 'system', id: 'm8', sessionId: 's1' }, // missing text
    ];
    expect(parseConversation(input)).toEqual([valid]);
  });

  // בדיקה: כל הודעה בנתוני המוק הדו-לשוניים עוברת את הסכימה — שום הודעה תקינה לא נזרקת.
  it('accepts every message in the mock conversation', () => {
    for (const lang of ['he', 'en'] as const) {
      const messages = mockConversation[lang];
      expect(parseConversation(messages)).toHaveLength(messages.length);
    }
  });
});
