import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProfile } from '../app/api';
import { connectSellerPhotos } from './connect-seller-photos';

// B1 brings the P3 profile to S1 together with the seller's photos; S1 stores them through S2.
vi.mock('../app/api', () => ({ getCurrentProfile: vi.fn() }));

const p3Profile = {
  id: 'p3-profile-1',
  sessionId: 'p3-session',
  language: 'en' as const,
  serviceConsent: { granted: false },
  marketingConsent: { granted: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const storedPhoto = (fileId: string, originalName: string) => ({
  fileId,
  profileId: p3Profile.id,
  itemId: 'seller-photos-1',
  originalName,
  mimeType: 'image/jpeg',
  size: 6,
  previewUri: `/evidence/${p3Profile.id}/${fileId}`,
  downloadUri: `/evidence/${p3Profile.id}/${fileId}/download`,
});

const jpeg = (name: string) => new File(['pixels'], name, { type: 'image/jpeg' });

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue(p3Profile);
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getCurrentProfile).mockReset();
});

describe('connectSellerPhotos', () => {
  // הצ'אט מוסר ל-S1 את כל הקבצים בבקשה אחת, תחת הפרופיל של P3 ולא תחת מזהה אחר.
  it('hands all the files to S1 in one request under the P3 profile', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([storedPhoto('f1', 'front.jpg'), storedPhoto('f2', 'back.jpg')]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await connectSellerPhotos([jpeg('front.jpg'), jpeg('back.jpg')], vi.fn());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/seller-intake/draft/${p3Profile.id}/[^/]+/photos$`));
    expect(init.method).toBe('POST');
    const sentNames = (init.body as FormData).getAll('files').map((file) => (file as File).name);
    expect(sentNames).toEqual(['front.jpg', 'back.jpg']);
  });

  // מה ש-S1 מחזירה מוצג בשיחה כהודעה אחת של המוכרת עם כל התמונות, אחרי שורת "בודק את התמונות…".
  it('shows what S1 returns as one seller update with all the photos', async () => {
    const photos = [storedPhoto('f1', 'front.jpg'), storedPhoto('f2', 'back.jpg')];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(photos), { status: 201 })));
    const onUpdate = vi.fn();

    await connectSellerPhotos([jpeg('front.jpg'), jpeg('back.jpg')], onUpdate);

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenNthCalledWith(1, { speaker: 'system', text: expect.stringMatching(/^(?:בודק את התמונות…|Checking the photos…)$/) });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { speaker: 'seller', images: photos });
  });

  // אותה שיחה מקבלת אותו sessionId בכל העלאה, כדי ש-S1 תצרף לאותה טיוטה.
  it('uses the same session for every upload', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify([storedPhoto('f1', 'front.jpg')]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await connectSellerPhotos([jpeg('front.jpg')], vi.fn());
    await connectSellerPhotos([jpeg('back.jpg')], vi.fn());

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toBe(urls[1]);
  });

  // כש-S1 דוחה (למשל S2 דחתה את הקבצים) נזרקת שגיאה ושום הודעה לא מוצגת.
  it('throws and shows only the checking line when S1 rejects the upload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 400 })));
    const onUpdate = vi.fn();

    await expect(connectSellerPhotos([jpeg('front.jpg')], onUpdate)).rejects.toThrow();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ speaker: 'seller' }));
  });

  // בלי קבצים אין מה למסור.
  it('throws without calling S1 when there are no files', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(connectSellerPhotos([], vi.fn())).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
