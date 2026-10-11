import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { AppHeader } from './AppHeader';
import i18n from '../i18n';

// מחזיר את הסביבה למצב התחלתי אחרי כל בדיקה: fetch אמיתי ושפה אנגלית.
afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

// Helper: פרופיל תקין שהשרת מחזיר אחרי שמירת שפה.
function profileResponse(language: 'he' | 'en') {
  const consent = { granted: false };
  const now = '2026-01-01T10:00:00.000Z';
  const profile = {
    id: 'profile-1',
    sessionId: 'session-1',
    language,
    serviceConsent: consent,
    marketingConsent: consent,
    createdAt: now,
    updatedAt: now,
  };
  return new Response(JSON.stringify(profile), { status: 200 });
}

// Helper: renders the header with the providers it needs (router and query client).
function renderHeader() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Verifies the header offers a way into both chat roles without typing a URL.
describe('AppHeader', () => {
  it('links to the buyer chat at /chat/buyer', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Find an item' })).toHaveAttribute('href', '/chat/buyer');
  });

  it('links to the seller chat at /chat/seller', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Sell an item' })).toHaveAttribute('href', '/chat/seller');
  });

  // בודק שכשהשמירה בשרת נכשלת, המשתמשת רואה הודעת שגיאה, השפה לא משתנה והכפתור נפתח כדי לנסות שוב.
  it('shows an error and keeps the language when saving the language fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server error', { status: 500 })));
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the language. Please try again.');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('button', { name: 'עברית' })).toBeEnabled();
  });

  // בודק שבזמן ששמירת השפה עדיין רצה הכפתור מושבת (אי אפשר ללחוץ פעמיים) והשפה עוד לא התחלפה,
  // ושכשהשרת מאשר הכפתור נפתח והמסך עובר לעברית.
  it('disables the button while the language is being saved and switches after the server confirms', async () => {
    // התשובה נפתרת רק כשהבדיקה קוראת ל-confirm: מדמה שרת שעוד לא ענה.
    let confirm!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            confirm = () => resolve(profileResponse('he'));
          }),
      ),
    );
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'עברית' })).toBeDisabled());
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');

    confirm();

    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'English' })).toBeEnabled());
  });

  // בודק שהודעת השגיאה נעלמת כשניסיון חוזר מצליח, והמסך עובר לעברית.
  it('clears the error and switches the language when a retry succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('server error', { status: 500 }))
        .mockResolvedValue(profileResponse('he')),
    );
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('dir', 'rtl'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
