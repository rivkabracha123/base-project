import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auctionLotFixtureSchema } from '@monabid/shared';
import { App } from './App';
import { getLotById } from './app/api';
import { createQueryClient } from './app/query-client';
import fixtures from '../../../fixtures/auction-data/lots.json';
import i18n from './i18n';

vi.mock('./app/api', () => ({
  getSampleLot: vi.fn(),
  getLotById: vi.fn(),
  getConversation: vi.fn(),
}));

const [lot] = auctionLotFixtureSchema.parse(fixtures);

if (!lot) {
  throw new Error('B4 fixture journey requires a validated auction lot');
}

afterEach(() => vi.clearAllMocks());

describe('B4 fixture journey', () => {
  it('opens a selected result and shows its exact source evidence', async () => {
    vi.mocked(getLotById).mockResolvedValue(lot);
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

    expect(await screen.findByRole('link', { name: /View Original Lot on Auction Site/ })).toHaveAttribute(
      'href',
      'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
    );
  });
});
