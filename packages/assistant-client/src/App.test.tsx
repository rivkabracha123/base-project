import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createQueryClient } from './app/query-client';
import './i18n';

const lot = {
  id: 'lot-1',
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/source', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Example House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Source-backed lot' },
  description: { en: 'Description' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold',
  realizedPrice: { amount: 1200, currency: 'USD' },
};

afterEach(() => vi.unstubAllGlobals());

describe('sample route', () => {
  it('renders a validated API lot with its source link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(lot), { status: 200 })));
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sample']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Source-backed lot' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View exact source' })).toHaveAttribute('href', 'https://example.com/source');
  });
});
