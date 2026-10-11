import { describe, it, expect } from 'vitest';
import { parseConversation } from './messages';
import { mockConversation } from './mock-conversation';

// Tests for parseConversation.
describe('parseConversation', () => {
  // Positive: a valid buyer message is kept as-is.
  it('keeps a valid buyer message', () => {
    const input = [
      { speaker: 'buyer', id: 'm1', sessionId: 's1', skipped: false, text: 'שלום' },
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

  // Positive: a valid system message is kept as-is.
  it('keeps a valid system message', () => {
    const input = [
      { speaker: 'system', id: 'm3', sessionId: 's1', text: 'מחפש בארכיון…' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid error message is kept; it has a code field in addition to text.
  it('keeps a valid error message', () => {
    const input = [
      { speaker: 'error', id: 'm4', sessionId: 's1', code: 'results_failed', text: 'טעינת התוצאות נכשלה.' },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid result-group message is kept; its lots field is a list of items per the auctionLotSchema contract.
  it('keeps a valid result-group message', () => {
    // שולפים את ה-lots מהודעת ה-result-group שבנתוני המוק, כדי לא לשכפל פריט מכירה שלם בטסט.
    const resultGroup = mockConversation.he.find((message) => message.speaker === 'result-group');
    if (resultGroup?.speaker !== 'result-group') throw new Error('mock: expected a result-group message');
    const input = [
      { speaker: 'result-group', id: 'm5', sessionId: 's1', lots: resultGroup.lots },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a valid no-results message (B3 unmatched-demand outcome) is kept as-is.
  it('keeps a valid no-results message', () => {
    const input = [
      {
        speaker: 'no-results',
        id: 'm10',
        sessionId: 's1',
        text: 'No matching items were found. Your request has been saved for our team.',
      },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a no-results message missing the text field is dropped.
  it('drops a no-results message that is missing the text field', () => {
    const input = [{ speaker: 'no-results', id: 'm11', sessionId: 's1' }];
    expect(parseConversation(input)).toEqual([]);
  });

  // Negative: a buyer message missing the text field is dropped.
  it('drops a message that is missing a required field', () => {
    const input = [{ speaker: 'buyer', id: 'm6', sessionId: 's1', skipped: false }];
    expect(parseConversation(input)).toEqual([]);
  });

  // Negative: a non-array input returns an empty list instead of crashing.
  it('returns an empty list when the input is not an array', () => {
    expect(parseConversation('not an array')).toEqual([]);
    expect(parseConversation(null)).toEqual([]);
    expect(parseConversation({ speaker: 'buyer' })).toEqual([]);
  });

  // Mixed: from a list of valid and invalid entries, only the valid ones are kept, in the same order.
  it('keeps only the valid messages from a mixed list', () => {
    const valid = { speaker: 'buyer', id: 'm7', sessionId: 's1', skipped: false, text: 'שלום' };
    const input = [
      valid,
      { speaker: 'banana', id: 'm8', sessionId: 's1' },
      { speaker: 'system', id: 'm9', sessionId: 's1' }, // missing text
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

  // Positive: the other-categories marker and the match reasons survive parsing.
  it('keeps the other-categories marker and the match reasons of a result group', () => {
    const group = mockConversation.en.find((message) => message.speaker === 'result-group');
    if (!group || group.speaker !== 'result-group') throw new Error('mock conversation has no result group');
    const [lot] = group.lots;
    if (!lot) throw new Error('mock conversation has no lot');
    const input = [
      { ...group, variant: 'other-categories', matchReasons: { [lot.id]: [{ field: 'creators', detail: 'Test Maker' }] } },
    ];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: a match reason without the field it refers to makes the whole group invalid.
  it('drops a result group whose match reason has no field', () => {
    const group = mockConversation.en.find((message) => message.speaker === 'result-group');
    if (!group || group.speaker !== 'result-group') throw new Error('mock conversation has no result group');
    const input = [{ ...group, matchReasons: { 'mock-lot-1': [{ detail: 'Test Maker' }] } }];
    expect(parseConversation(input)).toEqual([]);
  });
});
