import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EvidenceGallery } from './evidenceGallery';
import {
  deleteEvidence,
  getProfileEvidence,
  saveProfileEvidenceOrder,
  uploadItemEvidence,
  type EvidenceReference,
} from './api';
import '../i18n';

vi.mock('./api', () => ({
  deleteEvidence: vi.fn(),
  evidenceUrl: (path: string) => `http://localhost:3001/api${path}`,
  fetchEvidenceObjectUrl: vi.fn(async (path: string) => `blob:test${path}`),
  getProfileEvidence: vi.fn(),
  saveProfileEvidenceOrder: vi.fn(),
  uploadItemEvidence: vi.fn(),
}));

const profileId = 'demo-profile-gallery';

const photoA: EvidenceReference = {
  fileId: 'file-a',
  profileId,
  itemId: 'item-1',
  originalName: 'front.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  previewUri: `/evidence/${profileId}/file-a`,
  downloadUri: `/evidence/${profileId}/file-a/download`,
};

const photoB: EvidenceReference = {
  fileId: 'file-b',
  profileId,
  itemId: 'item-1',
  originalName: 'detail.png',
  mimeType: 'image/png',
  size: 4096,
  previewUri: `/evidence/${profileId}/file-b`,
  downloadUri: `/evidence/${profileId}/file-b/download`,
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderGallery() {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <EvidenceGallery profileId={profileId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getProfileEvidence).mockReset();
  vi.mocked(deleteEvidence).mockReset();
  vi.mocked(saveProfileEvidenceOrder).mockReset();
  vi.mocked(uploadItemEvidence).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('EvidenceGallery', () => {
  it('renders the photos returned by the evidence API', async () => {
    vi.mocked(getProfileEvidence).mockResolvedValue([photoA, photoB]);

    renderGallery();

    expect(
      await screen.findByAltText('front.jpg'),
    ).toBeInTheDocument();

    expect(
      screen.getByAltText('detail.png'),
    ).toBeInTheDocument();

    expect(getProfileEvidence).toHaveBeenCalledWith(
      profileId,
      expect.any(AbortSignal),
    );
  });

  it('renders the empty state when the profile has no photos', async () => {
    vi.mocked(getProfileEvidence).mockResolvedValue([]);

    renderGallery();

    expect(
      await screen.findByText('There are no photos in this profile yet.'),
    ).toBeInTheDocument();
  });

  it('renders the load error and retries the request', async () => {
    vi.mocked(getProfileEvidence)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([photoA]);

    renderGallery();

    expect(
      await screen.findByText('Network error'),
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', {
      name: 'Try again',
    });

    fireEvent.click(retryButton);

    expect(
      await screen.findByAltText('front.jpg'),
    ).toBeInTheDocument();

    expect(getProfileEvidence).toHaveBeenCalledTimes(2);
  });

  it('uploads selected photos and refreshes the gallery', async () => {
    vi.mocked(getProfileEvidence)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([photoA]);

    vi.mocked(uploadItemEvidence).mockResolvedValue([photoA]);

    renderGallery();

    const input = await screen.findByLabelText(
      'Choose photos for a new item',
    );

    const file = new File(['image-data'], 'front.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadItemEvidence).toHaveBeenCalledTimes(1);
    });

    expect(uploadItemEvidence).toHaveBeenCalledWith(
      profileId,
      expect.stringMatching(/^gallery-/),
      [file],
    );

    expect(
      await screen.findByAltText('front.jpg'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Photos were added to the gallery.'),
    ).toBeInTheDocument();
  });

  it('deletes a photo after the user confirms', async () => {
    vi.mocked(getProfileEvidence)
      .mockResolvedValueOnce([photoA, photoB])
      .mockResolvedValueOnce([photoB]);

    vi.mocked(deleteEvidence).mockResolvedValue({
      success: true,
    });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    renderGallery();

    expect(
      await screen.findByAltText('front.jpg'),
    ).toBeInTheDocument();

    const actionButtons = screen.getAllByRole('button', {
      name: 'More actions',
    });

    fireEvent.click(actionButtons[0]!);

    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Delete',
      }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete this photo?',
    );

    await waitFor(() => {
      expect(deleteEvidence).toHaveBeenCalledWith(
        profileId,
        photoA.fileId,
      );
    });

    expect(
      await screen.findByAltText('detail.png'),
    ).toBeInTheDocument();

    expect(
      screen.queryByAltText('front.jpg'),
    ).not.toBeInTheDocument();
  });

  it('reorders photos with the keyboard and saves the new order', async () => {
    vi.mocked(getProfileEvidence).mockResolvedValue([
      photoA,
      photoB,
    ]);

    vi.mocked(saveProfileEvidenceOrder).mockResolvedValue([
      photoB,
      photoA,
    ]);

    renderGallery();

    const firstPhoto = await screen.findByAltText('front.jpg');

    fireEvent.keyDown(firstPhoto, {
      key: 'ArrowDown',
    });

    await waitFor(() => {
      expect(saveProfileEvidenceOrder).toHaveBeenCalledWith(
        profileId,
        ['file-b', 'file-a'],
      );
    });
  });
});