import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { getAnonymousSessionId } from './app/api';
import { createQueryClient } from './app/query-client';
import i18n from './i18n';

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

const profile = {
  id: 'profile-1',
  sessionId: 'test-session-1',
  language: 'en',
  preferredName: null,
  email: null,
  phone: null,
  serviceConsent: { granted: false },
  marketingConsent: { granted: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  // Reset browser storage and global stubs so tests never affect one another.
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('anonymous browser session', () => {
  it('Test 3a: creates and saves an identifier for a new browser', () => {
    // Use a fixed value instead of random browser output.
    const randomUUID = vi.fn(() => 'new-test-session-id');
    vi.stubGlobal('crypto', { randomUUID });

    const sessionId = getAnonymousSessionId();

    // A new visitor receives the generated identifier.
    expect(sessionId).toBe('new-test-session-id');

    // The identifier is saved for the next visit from this browser.
    expect(localStorage.getItem('anonymousSessionId')).toBe(
      'new-test-session-id',
    );
  });

  it('Test 3b: reuses an identifier already saved in the browser', () => {
    // Simulate a visitor who has already opened the application before.
    localStorage.setItem('anonymousSessionId', 'saved-test-session-id');
    const randomUUID = vi.fn(() => 'replacement-session-id');
    vi.stubGlobal('crypto', { randomUUID });

    const sessionId = getAnonymousSessionId();

    // A returning visitor keeps the same anonymous profile owner.
    expect(sessionId).toBe('saved-test-session-id');

    // The browser must not generate a replacement identifier.
    expect(randomUUID).not.toHaveBeenCalled();
  });
});

describe('sample route', () => {
  it('renders a validated API lot with its source link', async () => {
    // The app now requests both the current profile and the sample lot.
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = input.toString();
      const body = url.includes('/profiles/me') ? profile : lot;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }));
    await i18n.changeLanguage('en');
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
