import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auctionLotFixtureSchema } from '@monabid/shared';
import { App } from './App';
import { getSampleLot } from './app/api';
import { createQueryClient } from './app/query-client';
import fixtures from '../../../fixtures/auction-data/lots.json';
import './i18n';

vi.mock('./app/api', () => ({
  getCurrentProfile: vi.fn().mockResolvedValue({ language: 'en' }),
  updateProfileLanguage: vi.fn(),
  getSampleLot: vi.fn(),
  getLotById: vi.fn(),
  getConversation: vi.fn(),
}));

const [lot] = auctionLotFixtureSchema.parse(fixtures);

if (!lot) {
  throw new Error('App fixture test requires a validated auction lot');
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('sample route', () => {
  it('renders the fixture lot with its source link', async () => {
    vi.mocked(getSampleLot).mockResolvedValue(lot);
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sample']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Atereth Zekeinim by Yitzhak Abrabanel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View exact source' })).toHaveAttribute('href', 'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en');
  });
});
