import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CurrentProfileGallery } from './CurrentProfileGallery';
import { getCurrentProfile, getProfileEvidence, type EvidenceReference } from './api';
import '../i18n';

vi.mock('./api', () => ({
  deleteEvidence: vi.fn(),
  evidenceUrl: (path: string) => `http://localhost:3001/api${path}`,
  getCurrentProfile: vi.fn(),
  getProfileEvidence: vi.fn(),
  saveProfileEvidenceOrder: vi.fn(),
  uploadItemEvidence: vi.fn(),
}));

// The seller's real profile, as the profile endpoint returns it.
const profile = {
  id: 'real-profile-1',
  sessionId: 's1',
  language: 'en' as const,
  serviceConsent: { granted: false },
  marketingConsent: { granted: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// A photo the seller uploaded from the chat to that profile.
const chatPhoto: EvidenceReference = {
  fileId: 'file-chat-1',
  profileId: profile.id,
  itemId: 'chat-1',
  originalName: 'from-chat.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  previewUri: `/evidence/${profile.id}/file-chat-1`,
  downloadUri: `/evidence/${profile.id}/file-chat-1/download`,
};

function renderGallery() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentProfileGallery />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getProfileEvidence).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CurrentProfileGallery', () => {
  // בודק שהגלריה מציגה את התמונות של הפרופיל האמיתי של המוכרת, כולל תמונות שהועלו מהצ'אט.
  it('shows the photos of the current profile, including photos uploaded from the chat', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile);
    vi.mocked(getProfileEvidence).mockResolvedValue([chatPhoto]);

    renderGallery();

    expect(await screen.findByAltText('from-chat.jpg')).toBeInTheDocument();
    expect(getProfileEvidence).toHaveBeenCalledWith(profile.id, expect.any(AbortSignal));
  });

  // בודק שכל עוד הפרופיל נטען לא מוצגת גלריה של פרופיל אחר, ושאין בקשת תמונות.
  it('does not ask for any photos before the profile is known', () => {
    vi.mocked(getCurrentProfile).mockReturnValue(new Promise(() => {}));

    renderGallery();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(getProfileEvidence).not.toHaveBeenCalled();
  });

  // בודק שכשטעינת הפרופיל נכשלת מוצגת שגיאה עם ניסיון חוזר, ולא גלריה.
  it('shows an error with a retry button when the profile cannot be loaded', async () => {
    vi.mocked(getCurrentProfile).mockRejectedValue(new Error('profile failed'));

    renderGallery();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(getProfileEvidence).not.toHaveBeenCalled();
  });
});
