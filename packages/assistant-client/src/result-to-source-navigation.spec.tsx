import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auctionLotFixtureSchema } from '@monabid/shared';
import { App } from './App';
import { getCurrentProfile, getLotById } from './app/api';
import { createQueryClient } from './app/query-client';
import fixtures from '../../../fixtures/auction-data/lots.json';
import i18n from './i18n';

vi.mock('./app/api', () => ({
  getSampleLot: vi.fn(),
  getLotById: vi.fn(),
  getConversation: vi.fn(),
  getCurrentProfile: vi.fn(),
  updateProfileLanguage: vi.fn(),
}));

const [lot] = auctionLotFixtureSchema.parse(fixtures);

if (!lot) {
  throw new Error('B4 fixture journey requires a validated auction lot');
}

const profile = {
  id: 'profile-1',
  sessionId: 'test-session-1',
  language: 'en' as const,
  preferredName: null,
  email: null,
  phone: null,
  serviceConsent: { granted: false },
  marketingConsent: { granted: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => vi.clearAllMocks());

describe('B4 fixture journey', () => {
  it('opens a selected result, preserves safe source evidence, and returns to results', async () => {
    vi.mocked(getLotById).mockResolvedValue(lot);
    vi.mocked(getCurrentProfile).mockResolvedValue(profile);
    await i18n.changeLanguage('en');
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/results']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: 'View item details' }))[0]!);

    const sourceLink = await screen.findByRole('link', { name: /View Original Lot on Auction Site/ });

    expect(sourceLink).toHaveAttribute(
      'href',
      'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
    );
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Results' }));

    expect(await screen.findByRole('heading', { name: 'Auction matches' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View item details' })).not.toHaveLength(0);
  });
});
