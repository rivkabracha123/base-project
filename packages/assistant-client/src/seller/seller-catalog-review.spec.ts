import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { SellerUpdate } from '../chat/chat-types';
import { correctSellerDraftField } from './connect-seller-correction';
import { continueSellerCatalogReview, resetSellerCatalogReview, startSellerCatalogReview } from './seller-catalog-review';

vi.mock('./connect-seller-correction', () => ({ correctSellerDraftField: vi.fn() }));

const ids = { profileId: 'p', sessionId: 's' };
const drafted = 'כתב יד מרהיב על קלף, במצב טוב.';

type UpdateMock = Mock<(update: SellerUpdate) => void>;

function texts(update: UpdateMock) {
  return update.mock.calls.map((call) => (call[0] as { text?: string }).text);
}

describe('seller catalog description review', () => {
  let update: UpdateMock;
  beforeEach(async () => {
    vi.mocked(correctSellerDraftField).mockReset();
    update = vi.fn();
    await startSellerCatalogReview('s', 'he', { he: drafted, en: '' }, update);
    update.mockClear();
  });
  afterEach(() => {
    resetSellerCatalogReview();
    vi.unstubAllGlobals();
  });

  it('shows only the text, then the save-or-update question', async () => {
    const shown = vi.fn();
    await startSellerCatalogReview('s', 'he', { he: drafted, en: '' }, shown);
    expect(texts(shown)).toEqual([drafted, 'לשמור את התיאור בפרטי הפריט, או לעדכן אותו?']);
    expect(correctSellerDraftField).not.toHaveBeenCalled();
  });

  it.each(['שמור', 'כן, תשמרי', 'מעולה', 'תשאיר', 'תשאירי כמו שזה', 'טוב', 'save it', 'keep it'])('saves the description to the item on "%s"', async (answer) => {
    expect(await continueSellerCatalogReview(answer, ids, update)).toBe(true);
    expect(correctSellerDraftField).toHaveBeenCalledWith('description', { he: drafted });
    expect(texts(update)).toEqual(['שמרתי את התיאור בפרטי הפריט.']);
    expect(await continueSellerCatalogReview('שמור', ids, update)).toBe(false);
  });

  it.each(['לא', 'אל תשמור', 'cancel'])('does not save on "%s"', async (answer) => {
    expect(await continueSellerCatalogReview(answer, ids, update)).toBe(true);
    expect(correctSellerDraftField).not.toHaveBeenCalled();
    expect(texts(update)).toEqual(['בסדר, התיאור לא נשמר.']);
  });

  it('asks what to change, then revises with the seller\'s answer and asks again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { he: 'כתב יד על קלף.', en: '', revised: true } })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await continueSellerCatalogReview('לעדכן', ids, update)).toBe(true);
    expect(texts(update)).toEqual(['מה לשנות בתיאור? אפשר לכתוב מה לשנות, או לכתוב את התיאור המלא כפי שהוא צריך להופיע.']);
    expect(fetchMock).not.toHaveBeenCalled();

    update.mockClear();
    expect(await continueSellerCatalogReview('שיהיה יותר קצר וענייני', ids, update)).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ profileId: 'p', structuredAnswer: { functionToRun: 'getSellerCatalogDraft',
      object: { sessionId: 's', previous: drafted, revision: 'שיהיה יותר קצר וענייני', language: 'he' } } });
    expect(texts(update)).toEqual(['כתב יד על קלף.', 'לשמור את התיאור בפרטי הפריט, או לעדכן אותו?']);

    update.mockClear();
    await continueSellerCatalogReview('שמור', ids, update);
    expect(correctSellerDraftField).toHaveBeenCalledWith('description', { he: 'כתב יד על קלף.' });
  });

  it('revises directly when the instruction comes with the update request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { he: 'כתב יד קצר.', en: '', revised: true } }))));
    expect(await continueSellerCatalogReview('תקצר אותו', ids, update)).toBe(true);
    expect(texts(update)).toEqual(['כתב יד קצר.', 'לשמור את התיאור בפרטי הפריט, או לעדכן אותו?']);
  });

  it('keeps waiting for the full text when the revision could not be applied', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { he: drafted, en: '', revised: false } }))));
    await continueSellerCatalogReview('תקצר', ids, update);
    expect(texts(update)).toEqual(['לא הצלחתי לעדכן את התיאור כרגע. אפשר לכתוב את התיאור המלא כפי שהוא צריך להופיע.']);
    expect(correctSellerDraftField).not.toHaveBeenCalled();
  });

  it.each(['לא טוב', 'לא אהבתי', "I don't like it"])('asks what to change on "%s"', async (answer) => {
    expect(await continueSellerCatalogReview(answer, ids, update)).toBe(true);
    expect(texts(update)).toEqual(['מה לשנות בתיאור? אפשר לכתוב מה לשנות, או לכתוב את התיאור המלא כפי שהוא צריך להופיע.']);
    expect(correctSellerDraftField).not.toHaveBeenCalled();
  });

  it('asks again on a short answer it does not understand, keeping the description', async () => {
    expect(await continueSellerCatalogReview('אממ', ids, update)).toBe(true);
    expect(texts(update)).toEqual(['לא הבנתי. לשמור את התיאור בפרטי הפריט, או לעדכן אותו?']);
    await continueSellerCatalogReview('תשאיר', ids, update);
    expect(correctSellerDraftField).toHaveBeenCalledWith('description', { he: drafted });
  });

  it('lets an unrelated message continue the normal conversation without saving', async () => {
    expect(await continueSellerCatalogReview('כמה הפריט שווה?', ids, update)).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(correctSellerDraftField).not.toHaveBeenCalled();
    expect(await continueSellerCatalogReview('שמור', ids, update)).toBe(false);
  });

  it('ignores another conversation', async () => {
    expect(await continueSellerCatalogReview('שמור', { profileId: 'p', sessionId: 'other' }, update)).toBe(false);
  });
});
