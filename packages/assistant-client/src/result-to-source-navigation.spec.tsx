import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreBuyerChatFlowState, resetBuyerChatFlowForTests } from './buyer/buyer-chat-flow';
import { auctionLotFixtureSchema } from '@monabid/shared';
import { App } from './App';
import { getCurrentProfile, getLotById } from './app/api';
import { createQueryClient } from './app/query-client';
import fixtures from '../../../fixtures/auction-data/lots.json';
import i18n from './i18n';

vi.mock('./app/api', () => ({
  getCurrentProfile: vi.fn(),
  updateProfileLanguage: vi.fn(),
  getSampleLot: vi.fn(),
  getLotById: vi.fn(),
  getLotSaleHistory: vi.fn().mockResolvedValue([]),
  getConversation: vi.fn(),
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

beforeEach(() => restoreBuyerChatFlowState({ results: [lot] }));

afterEach(() => {
  resetBuyerChatFlowForTests();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

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

    fireEvent.click(await screen.findByText('Atereth Zekeinim by Yitzhak Abrabanel'));

    const sourceLink = await screen.findByRole('link', { name: /View Original Lot on Auction Site/ });

    expect(sourceLink).toHaveAttribute(
      'href',
      'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
    );
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Results' }));

    expect(await screen.findByRole('heading', { name: 'Auction matches' })).toBeInTheDocument();
    expect(screen.getByText('Atereth Zekeinim by Yitzhak Abrabanel')).toBeInTheDocument();
  });

  it('shows the local history only through the complete local demo journey', async () => {
    vi.stubEnv('VITE_LOCAL_HISTORY_DEMO', 'true');
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

    expect(screen.getByRole('heading', { name: 'Past sales' })).toBeInTheDocument();

    fireEvent.click(await screen.findByText('Atereth Zekeinim by Yitzhak Abrabanel'));

    expect(await screen.findByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kestenbaum & Company · 2016/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tiroche Auction House · 2020/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kedem Auction House · 2026/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Results' }));

    expect(await screen.findByRole('heading', { name: 'Auction matches' })).toBeInTheDocument();
  });
});
