import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectSellerLevels, sendSellerMessage } from './connect-seller-levels';
import type { SellerUpdate } from '../chat/chat-types';

describe('connectSellerLevels', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('sends seller text with internally managed ids and awaits the display callback', async () => {
    // הפרופיל מגיע מ-P3 (השרת), ולכן יש בקשה נוספת לפרופיל לפני בקשת הטיוטה.
    const p3Profile = {
      id: 'p3-profile-1',
      sessionId: 'p3-session',
      language: 'en',
      serviceConsent: { granted: false },
      marketingConsent: { granted: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/profiles/me')) return new Response(JSON.stringify(p3Profile), { status: 200 });
      return new Response(JSON.stringify({
        nextQuestion: { field: 'dimensions', he: 'מהן המידות?', en: 'What are the dimensions?' },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    let finishCallback: (() => void) | undefined;
    const callback = vi.fn((_update: SellerUpdate) => new Promise<void>((resolve) => {
      finishCallback = resolve;
    }));

    let finished = false;
    const operation = connectSellerLevels('  I have a painting  ', callback).then(() => { finished = true; });
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(finished).toBe(false);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'What are the dimensions?' });
    const draftCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/seller-intake/draft'));
    const request = draftCall?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ input: 'I have a painting' });
    // הפרופיל שנשלח ל-S1 הוא של P3, ולא מזהה שהצ'אט יצר בעצמו.
    expect(JSON.parse(String(request.body)).profileId).toBe('p3-profile-1');
    expect(JSON.parse(String(request.body)).sessionId).toBeTruthy();

    finishCallback?.();
    await operation;
    expect(finished).toBe(true);
  });

  it('reports and rejects empty messages without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();

    await expect(connectSellerLevels('  ', callback)).rejects.toThrow('יש להזין הודעה');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'error',
      code: 'SELLER_INTAKE_FAILED',
    }));
  });

  it('reports an API failure and rejects the returned promise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const callback = vi.fn();

    await expect(connectSellerLevels('I have a painting', callback)).rejects.toThrow('503');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'error',
      code: 'SELLER_INTAKE_FAILED',
    }));
  });
});

describe('sendSellerMessage', () => {
  it('displays system text through Tamar\'s callback and waits for it', async () => {
    let resolveUpdate: (() => void) | undefined;
    const callback = vi.fn(() => new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    }));
    let finished = false;

    const sending = sendSellerMessage('Please describe the item.', callback).then(() => {
      finished = true;
    });

    expect(callback).toHaveBeenCalledWith({
      speaker: 'system',
      text: 'Please describe the item.',
    });
    expect(finished).toBe(false);

    resolveUpdate?.();
    await sending;
    expect(finished).toBe(true);
  });
});