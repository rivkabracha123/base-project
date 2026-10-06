import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import i18n from '../i18n';
import { resources } from '../i18n/resources';
import { dashboardTermKeys, displayTerm, StaffOperationsDashboard } from './StaffOperationsDashboard';

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

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('he');
});

describe('StaffOperationsDashboard', () => {
  it.each(['he', 'en'] as const)('translates every dashboard term in %s', async language => {
    await i18n.changeLanguage(language);

    for (const [term, translationKey] of Object.entries(dashboardTermKeys)) {
      expect(displayTerm(term, language)).toBe(i18n.t(`dashboard.terms.${translationKey}`));
      expect(displayTerm(term, language)).not.toContain('dashboard.terms.');
    }
  });

  it('renders synthetic buyer and seller leads returned by the dashboard API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(leads), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('button', { name: /קונה סינתטי/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מוכרת סינתטית/ })).toBeInTheDocument();
    expect(screen.getByText('קונה')).toBeInTheDocument();
    expect(screen.getByText('מוכר')).toBeInTheDocument();
  });

  it('localizes the unmatched-demand demonstration card in Hebrew', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'anonymous-demand',
      type: 'buyer',
      clientName: 'Anonymous Demand',
      status: 'new',
      requestDetails: 'Original manuscript request with no matching result.',
      createdAt: '2026-09-07T11:58:37.000Z',
    }]), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('button', { name: new RegExp(resources.he.translation.dashboard.anonymousDemand) })).toBeInTheDocument();
    expect(screen.getByText(resources.he.translation.dashboard.demoNoMatchRequest)).toBeInTheDocument();
  });

  it('shows the known Hebrew demonstration lead in English when English is selected', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'lead-2',
      type: 'buyer',
      clientName: 'דנה לוי',
      status: 'pending',
      requestDetails: 'בקשה לקבלת פרטים על תנאי התשלום לקונים חדשים',
      createdAt: '2026-08-31T11:15:00.000Z',
    }]), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('button', { name: new RegExp(resources.en.translation.dashboard.demoLeads.lead2.name) })).toBeInTheDocument();
    expect(screen.getByText(resources.en.translation.dashboard.demoLeads.lead2.summary)).toBeInTheDocument();
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

  it('updates the existing dashboard when the selected application language changes', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: resources.en.translation.dashboard.title })).toBeInTheDocument();
    await i18n.changeLanguage('he');
    expect(await screen.findByRole('heading', { name: resources.he.translation.dashboard.title })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(resources.he.translation.dashboard.syntheticBuyer) }));

    expect(await screen.findAllByText(/כתב יד עברי נדיר/)).toHaveLength(2);
    expect(screen.getByText((_, element) => (
      element?.tagName === 'LI' && element.textContent === '121421 · נוכחי'
    ))).toBeInTheDocument();
    expect(screen.getByText((_, element) => (
      element?.tagName === 'LI' && element.textContent === '121424 · היסטורי'
    ))).toBeInTheDocument();
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
    expect(screen.getByText(/Insufficient comparable sales/)).toBeInTheDocument();
    expect(screen.queryByText('withhold.demo@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('+972-50-0000000')).not.toBeInTheDocument();
    expect(screen.queryByText(/1200/)).not.toBeInTheDocument();
  });
});

describe('StaffOperationsDashboard Week 5 filters', () => {
  const filterLeads = [
    {
      id: 'buyer-manuscript', type: 'buyer', clientName: 'קונה כתבי יד', status: 'new', category: 'manuscripts',
      requestDetails: 'בקשה לכתב יד.', createdAt: '2026-09-10T10:00:00.000Z',
    },
    {
      id: 'seller-judaica', type: 'seller', clientName: 'מוכר יודאיקה', status: 'reviewing', category: 'judaica',
      requestDetails: 'בקשה להערכת חפץ.', createdAt: '2026-09-09T10:00:00.000Z',
    },
    {
      id: 'buyer-judaica-old', type: 'buyer', clientName: 'קונה יודאיקה', status: 'new', category: 'judaica',
      requestDetails: 'בקשה ישנה.', createdAt: '2026-08-25T10:00:00.000Z',
    },
  ];

  it('applies lead type, status, category, and date filters together', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(filterLeads), { status: 200 })));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'סינון פניות' }));
    expect(screen.getByRole('option', { name: 'כתבי יד' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'יודאיקה' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('סוג פנייה'), { target: { value: 'buyer' } });
    fireEvent.change(screen.getByLabelText('סטטוס'), { target: { value: 'new' } });
    fireEvent.change(screen.getByLabelText('קטגוריה'), { target: { value: 'manuscripts' } });
    fireEvent.change(screen.getByLabelText('מתאריך'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('עד תאריך'), { target: { value: '2026-09-30' } });

    expect(await screen.findByRole('button', { name: /קונה כתבי יד/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /מוכר יודאיקה/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /קונה יודאיקה/ })).not.toBeInTheDocument();
  });

  it('explains when no lead matches the chosen filters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(filterLeads), { status: 200 })));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'סינון פניות' }));
    fireEvent.change(screen.getByLabelText('סוג פנייה'), { target: { value: 'seller' } });
    fireEvent.change(screen.getByLabelText('קטגוריה'), { target: { value: 'manuscripts' } });

    expect(await screen.findByText('לא נמצאו פניות התואמות לסינון')).toBeInTheDocument();
  });

  it('clears the open lead detail when that lead no longer matches the filters', async () => {
    const buyerDetail = {
      id: 'buyer-manuscript', type: 'buyer', status: 'new', criteria: { category: 'manuscripts' }, hardConstraints: [],
      results: [], unmatchedDemand: null,
      contact: {
        preferredName: null, email: null, phone: null, followUpStatus: 'contact_missing', serviceConsent: { granted: false },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).endsWith('/staff-operations/leads/buyer-manuscript')) {
        return Promise.resolve(new Response(JSON.stringify(buyerDetail), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(filterLeads), { status: 200 }));
    }));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /קונה כתבי יד/ }));
    expect(await screen.findByRole('heading', { name: 'קריטריונים' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'סינון פניות' }));
    fireEvent.change(screen.getByLabelText('סוג פנייה'), { target: { value: 'seller' } });

    expect(screen.queryByRole('heading', { name: 'קריטריונים' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /מוכר יודאיקה/ })).toBeInTheDocument();
  });

  it('shows filter controls in English when English is selected', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(filterLeads), { status: 200 })));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));

    expect(screen.getByLabelText('Lead type')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
  });

  it('keeps filter controls hidden until the filter button is selected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(filterLeads), { status: 200 })));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'סינון פניות' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('סוג פנייה')).not.toBeInTheDocument();
  });
});

describe('StaffOperationsDashboard Week 5 manual pipeline', () => {
  it('shows the next action and saves an approved status change for the selected lead', async () => {
    const lead = {
      id: 'pipeline-buyer', type: 'buyer', clientName: 'קונה לדוגמה', status: 'new',
      requestDetails: 'בקשה לדוגמה.', createdAt: '2026-09-10T10:00:00.000Z',
    };
    const detail = {
      id: 'pipeline-buyer', type: 'buyer', status: 'new', criteria: {}, hardConstraints: [], results: [], unmatchedDemand: null,
      contact: { preferredName: null, email: null, phone: null, followUpStatus: 'contact_missing', serviceConsent: { granted: false } },
    };
    const pipeline = {
      status: 'new', nextAction: 'לבדוק את הפנייה ולהתחיל טיפול.',
      statusHistory: [{ at: '2026-09-10T10:00:00.000Z', from: null, to: 'new' }], activityNotes: [],
    };
    const fetchMock = vi.fn().mockImplementation((input, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/pipeline') && init?.method === 'PATCH') {
        const update = JSON.parse(String(init.body)) as { status?: string; nextAction?: string };
        return Promise.resolve(new Response(JSON.stringify({
          ...pipeline,
          status: update.status ?? pipeline.status,
          nextAction: update.nextAction ?? pipeline.nextAction,
        }), { status: 200 }));
      }
      if (url.endsWith('/pipeline')) return Promise.resolve(new Response(JSON.stringify(pipeline), { status: 200 }));
      if (url.endsWith('/staff-operations/leads/pipeline-buyer')) return Promise.resolve(new Response(JSON.stringify(detail), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify([lead]), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /קונה לדוגמה/ }));
    expect(await screen.findByDisplayValue('לבדוק את הפנייה ולהתחיל טיפול.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'טיפול פנימי' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('עדכון סטטוס'), { target: { value: 'reviewing' } });
    const saveStatusButton = screen.getByRole('button', { name: 'שמירת סטטוס' });
    expect(saveStatusButton).not.toBeDisabled();
    fireEvent.click(saveStatusButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/pipeline-buyer/pipeline'), expect.objectContaining({ method: 'PATCH' })));
    expect(await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent?.includes(resources.he.translation.dashboard.terms.statusReviewing) === true)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('הפעולה הבאה'), { target: { value: 'לחזור אל הפונה ביום ראשון.' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת הפעולה הבאה' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/pipeline-buyer/pipeline'), expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ nextAction: 'לחזור אל הפונה ביום ראשון.' }),
    })));
    expect(await screen.findByText(resources.he.translation.dashboard.pipelineSaved)).toBeInTheDocument();
    expect(screen.getByDisplayValue('לחזור אל הפונה ביום ראשון.')).toBeInTheDocument();
  });
});
