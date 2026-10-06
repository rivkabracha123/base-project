import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import i18n from '../i18n';
import { StaffOperationsDashboard } from './StaffOperationsDashboard';

const leads = [
  {
    id: 'buyer-lead', type: 'buyer', clientName: 'קונה סינתטי', status: 'new',
    requestDetails: 'מחפש כתב יד נדיר.', createdAt: '2026-08-31T11:15:00.000Z',
  },
  {
    id: 'seller-lead', type: 'seller', clientName: 'מוכרת סינתטית', status: 'reviewing',
    requestDetails: 'מבקשת להגיש פריט למכירה.', createdAt: '2026-08-30T15:30:00.000Z',
  },
];

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

beforeEach(async () => {
  await i18n.changeLanguage('he');
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('he');
});

describe('StaffOperationsDashboard', () => {
  it('renders synthetic buyer and seller leads returned by the dashboard API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(leads), { status: 200 })));

    renderDashboard();

    expect(await screen.findByText('קונה סינתטי')).toBeInTheDocument();
    expect(screen.getByText('מוכרת סינתטית')).toBeInTheDocument();
    expect(screen.getByText('קונה')).toBeInTheDocument();
    expect(screen.getByText('מוכר')).toBeInTheDocument();
  });

  it('shows a loading state while the dashboard API is pending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));

    renderDashboard();

    expect(await screen.findByRole('status')).toHaveTextContent('טוען את לוח הבקרה התפעולי');
  });

  it('shows a retryable error when the dashboard API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לטעון את הפניות כרגע.');
    expect(screen.getByRole('button', { name: 'נסו שוב' })).toBeInTheDocument();
  });

  it('shows an empty state when the dashboard API returns no leads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'אין פניות להצגה כרגע.' })).toBeInTheDocument();
  });
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
describe('StaffOperationsDashboard Week 4', () => {
  it('shows a privacy-limited supported seller lead after selecting it', async () => {
    await i18n.changeLanguage('en');
    const sellerLead = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      clientName: 'Synthetic Seller',
      status: 'submitted',
      requestDetails: 'Synthetic silver menorah.',
      createdAt: '2026-09-14T10:00:00.000Z',
    };
    const sellerLeadDetail = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      status: 'submitted',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T11:00:00.000Z',
      item: { title: 'Synthetic silver menorah', category: 'judaica' },
      evidence: [{ id: 'evidence-001', type: 'image' }],
      comparables: [{ id: 'sale-001', source: { label: 'Source unavailable', url: null } }],
      valuation: {
        status: 'supported',
        reportId: 'report-001',
        valuationRange: { min: 1200, max: 1800, currency: 'USD' },
      },
      recommendation: { houseName: 'Synthetic Auction House', reason: 'Judaica focus' },
      alternatives: [],
      sellerChoice: { houseName: 'Synthetic Auction House' },
      catalogDraft: { title: 'Synthetic silver menorah' },
      contact: {
        preferredName: 'Synthetic Seller',
        email: 'seller.demo@example.test',
        phone: null,
        serviceConsentGranted: true,
      },
      history: [{ at: '2026-09-14T11:00:00.000Z', event: 'submitted', actor: 'seller' }],
      profileId: 'never-render-profile-id',
      sessionId: 'never-render-session-id',
      marketingConsent: true,
      evidencePath: '/private/evidence.jpg',
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).endsWith('/seller-leads/11111111-1111-4111-8111-111111111111')) {
        return Promise.resolve(new Response(JSON.stringify(sellerLeadDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([sellerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Synthetic Seller/ }));

    expect(await screen.findAllByText('Synthetic silver menorah')).toHaveLength(2);
    expect(screen.getByText(/evidence-001/)).toBeInTheDocument();
    expect(screen.getByText(/sale-001/)).toBeInTheDocument();
    expect(screen.getByText('seller.demo@example.test')).toBeInTheDocument();
    expect(screen.queryByText('never-render-profile-id')).not.toBeInTheDocument();
    expect(screen.queryByText('never-render-session-id')).not.toBeInTheDocument();
    expect(screen.queryByText('/private/evidence.jpg')).not.toBeInTheDocument();
  });

  it('shows a seller refusal without a price range and withholds contact without consent', async () => {
    await i18n.changeLanguage('en');
    const sellerLead = {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'seller',
      clientName: 'Refusal Seller',
      status: 'reviewing',
      requestDetails: 'Synthetic manuscript.',
      createdAt: '2026-09-14T10:00:00.000Z',
    };
    const sellerLeadDetail = {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'seller',
      status: 'reviewing',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T11:00:00.000Z',
      item: { title: 'Synthetic manuscript' },
      evidence: [{ id: 'evidence-002', type: 'provenance' }],
      comparables: [{ id: 'sale-002', source: { label: 'Source unavailable', url: null } }],
      valuation: { status: 'refusal', reportId: 'report-002', reason: 'insufficient_comparables' },
      recommendation: null,
      alternatives: [],
      sellerChoice: null,
      catalogDraft: null,
      contact: {
        preferredName: 'Refusal Seller',
        email: null,
        phone: null,
        serviceConsentGranted: false,
      },
      history: [{ at: '2026-09-14T11:00:00.000Z', event: 'ranked', actor: 'system' }],
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).endsWith('/seller-leads/22222222-2222-4222-8222-222222222222')) {
        return Promise.resolve(new Response(JSON.stringify(sellerLeadDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify([sellerLead]), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Refusal Seller/ }));

    expect(await screen.findByText(/Expert review required/)).toBeInTheDocument();
    expect(screen.getByText(/insufficient_comparables/)).toBeInTheDocument();
    expect(screen.queryByText('withhold.demo@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+972-50-0000000')).not.toBeInTheDocument();
    expect(screen.queryByText(/1200/)).not.toBeInTheDocument();
  });
});
