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

  // Reference to an uploaded photo, in the same shape the evidence API returns (EvidenceReference).
  const photo = {
    fileId: 'f1',
    profileId: 'p1',
    itemId: 'i1',
    originalName: 'vase.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    previewUri: '/evidence/p1/f1/preview',
    downloadUri: '/evidence/p1/f1/download',
  };

  // Positive: a seller message that carries only a photo (no text) is kept as-is.
  it('keeps a seller message that has only an image', () => {
    const input = [{ speaker: 'seller', id: 'm9', sessionId: 's1', image: photo }];
    expect(parseConversation(input)).toEqual(input);
  });

  // Positive: a seller message may carry both a photo and a text caption.
  it('keeps a seller message that has an image and text', () => {
    const input = [{ speaker: 'seller', id: 'm10', sessionId: 's1', text: 'הנה האגרטל', image: photo }];
    expect(parseConversation(input)).toEqual(input);
  });

  // Negative: an image whose file type is not an allowed photo type is dropped.
  it('drops a seller message whose image has an unsupported file type', () => {
    const input = [
      { speaker: 'seller', id: 'm11', sessionId: 's1', image: { ...photo, mimeType: 'application/pdf' } },
    ];
    expect(parseConversation(input)).toEqual([]);
  });

  // Negative: an image reference missing its file id cannot be displayed, so the message is dropped.
  it('drops a seller message whose image is missing its file id', () => {
    const { fileId: _fileId, ...imageWithoutFileId } = photo;
    const input = [{ speaker: 'seller', id: 'm12', sessionId: 's1', image: imageWithoutFileId }];
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
