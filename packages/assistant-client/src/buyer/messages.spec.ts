import { describe, it, expect } from 'vitest';
import { parseConversation } from './messages';
import conversationFixture from '../../../../fixtures/demo-scenarios/buyer-conversation.json';

// Tests for parseConversation.
describe('parseConversation', () => {
  // Positive: a valid buyer message is kept as-is.
  it('keeps a valid buyer message', () => {
    const input = [
      { kind: 'buyer', id: 'm1', at: '2026-01-01T10:00:00.000Z', text: 'שלום' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a message with an unknown kind is dropped and an empty list is returned.
  it('drops a message whose kind is not recognised', () => {
    const input = [
      { kind: 'banana', id: 'm2', at: '2026-01-01T10:00:05.000Z', text: 'x' },
    ];
    expect(parseConversation(input)).toEqual([]);
  });

  // Positive: a valid assistant message is kept as-is.
  it('keeps a valid assistant message', () => {
    const input = [
      { kind: 'assistant', id: 'm3', at: '2026-01-01T10:00:05.000Z', text: 'מחפש בארכיון…' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid error message is kept; it has a code field in addition to text.
  it('keeps a valid error message', () => {
    const input = [
      { kind: 'error', id: 'm4', at: '2026-01-01T10:00:10.000Z', code: 'results_failed', text: 'טעינת התוצאות נכשלה.' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid result-group message is kept; its lots field is a list of items per the auctionLotSchema contract.
  it('keeps a valid result-group message', () => {
    // The message at index 3 in the sample conversation is the result-group — a single source of truth per item.
    const resultGroup = conversationFixture.conversations.he[3];
    if (resultGroup?.kind !== 'result-group') throw new Error('fixture: expected a result-group at index 3');
    const input = [
      { kind: 'result-group', id: 'm5', at: '2026-01-01T10:00:15.000Z', title: 'פריטים דומים', lots: resultGroup.lots },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a buyer message missing the text field is dropped.
  it('drops a message that is missing a required field', () => {
    const input = [{ kind: 'buyer', id: 'm6', at: '2026-01-01T10:00:20.000Z' }];
    expect(parseConversation(input)).toEqual([]);
  });

  // Negative: a non-array input returns an empty list instead of crashing.
  it('returns an empty list when the input is not an array', () => {
    expect(parseConversation('not an array')).toEqual([]);
    expect(parseConversation(null)).toEqual([]);
    expect(parseConversation({ kind: 'buyer' })).toEqual([]);
  });

  // Mixed: from a list of valid and invalid entries, only the valid ones are kept, in the same order.
  it('keeps only the valid messages from a mixed list', () => {
    const valid = { kind: 'buyer', id: 'm7', at: '2026-01-01T10:00:25.000Z', text: 'שלום' };
    const input = [
      valid,
      { kind: 'banana', id: 'm8', at: '2026-01-01T10:00:26.000Z' },
      { kind: 'assistant', id: 'm9', at: '2026-01-01T10:00:27.000Z' }, // missing text
    ];
    expect(parseConversation(input)).toEqual([valid]);
  });

  // Integration: the sample conversation file passes the schema — every message in every language is kept.
  it('accepts every message in the sample conversation fixture', () => {
    for (const lang of ['he', 'en'] as const) {
      const messages = conversationFixture.conversations[lang];
      expect(parseConversation(messages)).toHaveLength(messages.length);
    }
  });
});
