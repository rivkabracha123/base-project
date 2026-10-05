import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createQueryClient } from './app/query-client';
import './i18n';

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
        id: 'house-kedem',
        name: 'Kedem Auction House',
        active: true,
        categories: ['judaica', 'rare_books'],
        languages: ['he', 'en'],
        comparableSoldCountByCategory: { rare_books: 1 },
      },
      score: 7,
      reasons: ['Prepared house lists specialization in rare_books'],
    },
  ],
  excluded: [],
};

const submittedLead = {
  id: 'lead-1',
  profileId: 'profile-synthetic-seller-1',
  contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
  recommendation: ranking,
  sellerChoice: { houseId: 'house-kedem', houseName: 'Kedem Auction House', source: 'seller' },
  catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
  item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
  evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
  valuation: {
    status: 'supported',
    reportId: 'valuation-001',
    comparableCount: 1,
    confidence: {
      level: 'low',
      explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
    },
    limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
    comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
    excludedComparables: [],
    valuationRange: { min: 800, max: 1200, currency: 'USD' },
  },
  status: 'submitted',
  history: [{ at: '2026-01-01T00:00:00.000Z', event: 'submitted', actor: 'seller' }],
  createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('seller enquiry route', () => {
  it('shows catalog draft before contact and submits an internal lead', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (method === 'PATCH' && url.includes('/profiles/me')) {
        return new Response(
          JSON.stringify({
            id: 'profile-p3-live',
            preferredName: 'Synthetic Seller',
            email: 'synthetic.seller@example.test',
            serviceConsent: { granted: true, grantedAt: '2026-10-05T00:00:00.000Z', channel: 'web' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (method === 'POST' && /\/seller-leads\/[^/]+\/final/.test(url)) {
        return new Response(JSON.stringify(submittedLead), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'POST' && /\/seller-leads\/[^/]+\/choice/.test(url)) {
        return new Response(JSON.stringify(submittedLead.sellerChoice), {
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
        <MemoryRouter initialEntries={['/seller/enquiry']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('Abstract landscape study')).length).toBeGreaterThan(0);
    expect(screen.getByText('evidence-001')).toBeInTheDocument();
    expect(screen.getByText(/Indicative range/)).toBeInTheDocument();
    expect(screen.getAllByText('Kestenbaum & Company').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/does not contact an auction house automatically/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/commission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will accept/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Kedem Auction House/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit internal enquiry' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Internal enquiry submitted for Kedem Auction House/);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/me'),
        expect.objectContaining({ headers: expect.objectContaining({ 'x-anonymous-session-id': expect.any(String) }) }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/seller-leads/lead-1/final'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('ranks and reviews catalog from S1 POST /api/seller-intake/draft', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method === 'POST' && url.includes('/seller-intake/draft')) {
        return new Response(
          JSON.stringify({
            language: { preferred: 'he' },
            item: {
              id: 'item-s1',
              category: 'paintings',
              title: 'S1 Confirmed Painting',
              evidenceIds: ['evidence-s1'],
              catalogDraft: { he: 'ציור מאושר', en: 'S1 Confirmed Painting' },
            },
            evidence: [{ id: 'evidence-s1', type: 'seller_statement', uri: 'file:///secret.jpg' }],
            confirmedFacts: { category: 'paintings' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('house-rankings')) {
        return new Response(JSON.stringify(ranking), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/profiles/me')) {
        return new Response('not found', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/seller/enquiry']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText('S1 Confirmed Painting')).length).toBeGreaterThan(0);
    expect(screen.getByText('evidence-s1')).toBeInTheDocument();
    expect(screen.queryByText('file:///secret.jpg')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/seller-leads/house-rankings'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ category: 'paintings', preferredLanguage: 'he' }),
        }),
      );
    });
  });

  it('prefills contact from P3 GET /api/profiles/me', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/profiles/me')) {
        return new Response(
          JSON.stringify({
            id: 'profile-p3-live',
            preferredName: 'Avishag From Profile',
            email: 'avishag.p3@example.test',
            serviceConsent: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('house-rankings')) {
        return new Response(JSON.stringify(ranking), {
          status: 200,
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
        <MemoryRouter initialEntries={['/seller/enquiry']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByDisplayValue('Avishag From Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('avishag.p3@example.test')).toBeInTheDocument();
  });
});
