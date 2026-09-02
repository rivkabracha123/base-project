import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './app/query-client';
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

afterEach(() => vi.unstubAllGlobals());

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
