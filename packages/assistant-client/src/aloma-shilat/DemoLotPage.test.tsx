import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { DemoLotPage } from './DemoLotPage';

describe('DemoLotPage', () => {
  it('renders data returned from the backend demo endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'demo-1',
            title: 'Demo Lot - Aloma Shilat',
            category: 'books',
            status: 'upcoming',
            saleDate: '2026-09-01',
            description: 'A demo lot built locally for the TDD assignment.',
          }),
          { status: 200 },
        ),
      ),
    );

    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <DemoLotPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Demo Lot - Aloma Shilat' })).toBeInTheDocument();
    expect(screen.getAllByText(/books/i).length).toBeGreaterThan(0);
  });
});
