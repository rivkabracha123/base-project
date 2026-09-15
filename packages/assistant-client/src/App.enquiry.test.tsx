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

    expect(await screen.findByText('Abstract landscape study')).toBeInTheDocument();
    expect(screen.getByText('evidence-001')).toBeInTheDocument();
    expect(screen.getByText(/Indicative range/)).toBeInTheDocument();
    expect(screen.getByText('Kestenbaum & Company')).toBeInTheDocument();
    expect(screen.getByText(/does not contact an auction house automatically/i)).toBeInTheDocument();
    expect(screen.queryByText(/commission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will accept/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Kedem Auction House/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit internal enquiry' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Internal enquiry submitted for Kedem Auction House/);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/seller-leads/lead-1/final'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
