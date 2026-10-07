import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createQueryClient } from './app/query-client';
import './i18n';

const chosenHouseId = 'house-kedem';
const chosenHouseName = 'Kedem Auction House';
const expectedChoice = { houseId: chosenHouseId, houseName: chosenHouseName, source: 'seller' as const };

const ranking = {
  recommendation: {
    house: {
      id: 'house-kestenbaum',
      name: 'Kestenbaum & Company',
      active: true,
      categories: ['rare_books'],
      languages: ['en'],
      comparableSoldCountByCategory: { rare_books: 4 },
    },
    score: 11,
    reasons: ['Prepared house lists specialization in rare_books'],
  },
  alternatives: [
    {
      house: {
        id: chosenHouseId,
        name: chosenHouseName,
        active: true,
        categories: ['judaica', 'rare_books'],
        languages: ['he', 'en'],
        comparableSoldCountByCategory: { rare_books: 1 },
      },
      score: 7,
      reasons: ['Prepared house lists specialization in rare_books'],
    },
  ],
  excluded: [
    {
      house: {
        id: 'house-inactive-demo',
        name: 'Inactive Prepared House',
        active: false,
        categories: ['rare_books'],
        languages: ['en'],
        comparableSoldCountByCategory: { rare_books: 9 },
      },
      score: 0,
      reasons: ['House is not marked active in prepared data'],
      exclusionReason: 'House is not marked active in prepared data',
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('seller house-choice route', () => {
  it('shows the recommendation and saves an alternative without claiming acceptance', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (method === 'GET' && url.endsWith('/profiles/me')) {
        return new Response(JSON.stringify({
          id: 'profile-1',
          sessionId: 'session-1',
          language: 'en',
          serviceConsent: { granted: false },
          marketingConsent: { granted: false },
          createdAt: '2026-09-15T00:00:00.000Z',
          updatedAt: '2026-09-15T00:00:00.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'POST' && /\/seller-leads\/[^/]+\/choice/.test(url)) {
        return new Response(JSON.stringify(expectedChoice), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('house-rankings')) {
        return new Response(JSON.stringify(ranking), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'POST' && url.includes('/seller-leads')) {
        return new Response(JSON.stringify({ id: 'lead-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/seller/houses']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Kestenbaum & Company')).toBeInTheDocument();
    expect(screen.getByText(chosenHouseName)).toBeInTheDocument();
    expect(screen.queryByText('Inactive Prepared House')).not.toBeInTheDocument();
    expect(await screen.findByText(/does not contact an auction house automatically/i)).toBeInTheDocument();
    expect(screen.queryByText(/commission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will accept/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(chosenHouseName) }));
    fireEvent.click(screen.getByRole('button', { name: 'Save house choice' }));

    expect(await screen.findByRole('status')).toHaveTextContent(chosenHouseName);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/seller-leads/lead-1/choice`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ houseId: chosenHouseId }),
        }),
      );
    });
  });
});
