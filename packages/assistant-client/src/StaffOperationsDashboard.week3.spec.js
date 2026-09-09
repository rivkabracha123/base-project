import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './app/query-client';
import i18n from './i18n';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';

function renderDashboard() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(StaffOperationsDashboard),
    ),
  );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('he');
});

describe('StaffOperationsDashboard Week 3', () => {
  it('renders dashboard labels in English when English is active', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Staff operations dashboard' })).toBeInTheDocument();
  });

  it('shows a privacy-limited buyer lead detail after selecting a buyer lead', async () => {
    const buyerLead = {
      id: 'buyer-lead-001',
      type: 'buyer',
      clientName: 'Synthetic Buyer',
      status: 'new',
      requestDetails: 'Rare manuscript request.',
      createdAt: '2026-09-06T09:00:00.000Z',
    };
    const buyerLeadDetail = {
      id: 'buyer-lead-001',
      type: 'buyer',
      status: 'new',
      criteria: { category: 'rare_hebrew_manuscript' },
      hardConstraints: [
        { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
      ],
      results: [
        { id: '121421', group: 'current' },
        { id: '121424', group: 'historical' },
      ],
      unmatchedDemand: {
        reason: 'no_results',
        originalCriteria: { category: 'rare_hebrew_manuscript' },
      },
      contact: {
        preferredName: 'Synthetic Buyer',
        email: null,
        phone: null,
        followUpStatus: 'consent_required',
        serviceConsent: { granted: false },
      },
      profileId: 'internal-profile-id',
      sessionId: 'never-render-session',
      marketingConsent: { granted: true },
      fullConversation: ['never render this'],
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/staff-operations/leads/buyer-lead-001')) {
        return Promise.resolve(new Response(JSON.stringify(buyerLeadDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Synthetic Buyer/ }));

    expect(await screen.findAllByText(/rare_hebrew_manuscript/)).toHaveLength(2);
    expect(screen.getByText((_, element) => (
      element?.tagName === 'LI' && element.textContent === '121421 · נוכחי'
    ))).toBeInTheDocument();
    expect(screen.getByText((_, element) => (
      element?.tagName === 'LI' && element.textContent === '121424 · היסטורי'
    ))).toBeInTheDocument();
    expect(screen.getByText(/no_results/)).toBeInTheDocument();
    expect(screen.queryByText('internal-profile-id')).not.toBeInTheDocument();
    expect(screen.queryByText('never-render-session')).not.toBeInTheDocument();
    expect(screen.queryByText('never render this')).not.toBeInTheDocument();
  });

  it('shows synthetic contact details only when service consent is ready', async () => {
    const buyerLead = {
      id: 'buyer-lead-003',
      type: 'buyer',
      clientName: 'Consent Ready Buyer',
      status: 'new',
      requestDetails: 'Synthetic request.',
      createdAt: '2026-09-06T11:00:00.000Z',
    };
    const buyerLeadDetail = {
      id: 'buyer-lead-003',
      type: 'buyer',
      status: 'new',
      criteria: {},
      hardConstraints: [],
      results: [],
      unmatchedDemand: null,
      contact: {
        preferredName: 'Consent Ready Buyer',
        email: 'contact.demo@example.test',
        phone: '+972-50-1234567',
        followUpStatus: 'ready',
        serviceConsent: { granted: true, policyVersion: 'v1.0' },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/staff-operations/leads/buyer-lead-003')) {
        return Promise.resolve(new Response(JSON.stringify(buyerLeadDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Consent Ready Buyer/ }));

    expect(await screen.findByText('contact.demo@example.test')).toBeInTheDocument();
    expect(screen.getByText('+972-50-1234567')).toBeInTheDocument();
  });

  it('withholds contact details when follow-up contact is missing', async () => {
    const buyerLead = {
      id: 'buyer-lead-005',
      type: 'buyer',
      clientName: 'Missing Contact Buyer',
      status: 'new',
      requestDetails: 'Synthetic request.',
      createdAt: '2026-09-06T13:00:00.000Z',
    };
    const buyerLeadDetail = {
      id: 'buyer-lead-005',
      type: 'buyer',
      status: 'new',
      criteria: {},
      hardConstraints: [],
      results: [],
      unmatchedDemand: null,
      contact: {
        preferredName: 'Missing Contact Buyer',
        email: 'withhold.demo@example.test',
        phone: '+972-50-0000000',
        followUpStatus: 'contact_missing',
        serviceConsent: { granted: true },
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/staff-operations/leads/buyer-lead-005')) {
        return Promise.resolve(new Response(JSON.stringify(buyerLeadDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Missing Contact Buyer/ }));

    expect(await screen.findByText('חסרים פרטי קשר')).toBeInTheDocument();
    expect(screen.queryByText('withhold.demo@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+972-50-0000000')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the buyer lead detail API fails', async () => {
    const buyerLead = {
      id: 'buyer-lead-004',
      type: 'buyer',
      clientName: 'Error State Buyer',
      status: 'new',
      requestDetails: 'Synthetic request.',
      createdAt: '2026-09-06T12:00:00.000Z',
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/staff-operations/leads/buyer-lead-004')) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Error State Buyer/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'נסו שוב' })).toBeInTheDocument();
  });

  it('shows a loading state while the selected buyer lead is loading', async () => {
    const buyerLead = {
      id: 'buyer-lead-loading',
      type: 'buyer',
      clientName: 'Loading Buyer',
      status: 'new',
      requestDetails: 'Synthetic request.',
      createdAt: '2026-09-06T14:00:00.000Z',
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).endsWith('/staff-operations/leads/buyer-lead-loading')) {
        return new Promise(() => {});
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Loading Buyer/ }));

    expect(screen.getByText(/טוען את לוח הבקרה התפעולי/)).toBeInTheDocument();
  });

  it('explains when a selected buyer lead no longer exists', async () => {
    const buyerLead = {
      id: 'buyer-lead-missing',
      type: 'buyer',
      clientName: 'Missing Buyer',
      status: 'new',
      requestDetails: 'Synthetic request.',
      createdAt: '2026-09-06T15:00:00.000Z',
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).endsWith('/staff-operations/leads/buyer-lead-missing')) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.resolve(new Response(JSON.stringify([buyerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Missing Buyer/ }));

    expect(await screen.findByText('הפנייה שנבחרה לא נמצאה.')).toBeInTheDocument();
  });
});
