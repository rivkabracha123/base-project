import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { AppHeader } from '../components/AppHeader';
import { BuyerChat } from './BuyerChat';
import { connectLevels } from './connect-levels';
import { mockConversation } from './mock-conversation';
import i18n from '../i18n';
import { soldLotFixture } from '../test/fixtures/auction-lots';
import { houseRankingSchema } from '@monabid/shared';

// חיבור רמות מזויף: הבדיקות שולטות במה שהוא שולח ל-callback ובמתי הוא מסיים.
vi.mock('./connect-levels', () => ({ connectLevels: vi.fn() }));

//רץ אחרי כל בדיקה מבטל mocks ומחזיר לשפה אנגלית
afterEach(async () => {
  vi.mocked(connectLevels).mockReset();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});

// Helper: renders the chat screen with the API returning the given response body.
function renderChat(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BuyerChat />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Helper: renders the chat screen with the conversation request failing with a server error.
function renderChatWithError() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server error', { status: 500 })));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BuyerChat />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Tests for the buyer chat screen.
describe('BuyerChat', () => {
  it('shows search progress as staggered step lines with icons, not chat bubbles', async () => {
    renderChat([
      { id: 'step-1', sessionId: 's1', speaker: 'system', text: 'Searching…' },
      { id: 'step-2', sessionId: 's1', speaker: 'results-found', text: 'Found 2 similar lots in upcoming sales' },
      { id: 'step-3', sessionId: 's1', speaker: 'results-found', text: 'Found 8 similar lots in the past sales archive' },
    ]);
    const searching = (await screen.findByText('Searching…')).closest('li')!;
    const archive = screen.getByText(/past sales archive/).closest('li')!;
    expect(searching).toHaveAttribute('data-step', 'true');
    expect(searching).toHaveTextContent('🔍');
    expect(archive).toHaveTextContent('🗂️');
    expect(archive.style.animationDelay).toBe('1400ms');
  });

  it('holds the result cards back until the search steps finished appearing', async () => {
    renderChat([
      { id: 'step-1', sessionId: 's1', speaker: 'system', text: 'Searching…' },
      { id: 'step-2', sessionId: 's1', speaker: 'results-found', text: 'Found 1 similar lots in upcoming sales' },
      { id: 'cards', sessionId: 's1', speaker: 'result-group', title: 'Upcoming lots', lots: [soldLotFixture] },
    ]);
    const cards = (await screen.findByRole('heading', { name: 'Upcoming lots' })).closest('li')!;
    expect(cards).toHaveClass('buyer-reveal');
    expect(cards.style.animationDelay).toBe('2600ms');
  });

  it('renders specialist houses inline without seller selection controls', async () => {
    const ranking = houseRankingSchema.parse({ recommendation: {
      house: { id: 'house-specialist', name: 'Manuscript specialist', active: true, categories: ['rare_books'], languages: ['he', 'en'], geography: 'Israel', comparableSoldCountByCategory: { rare_books: 3 } },
      score: 10, reasons: ['Category expertise'],
    }, alternatives: [], excluded: [] });
    renderChat([{ id: 'ranking-test', sessionId: 's1', speaker: 'house-ranking', category: 'rare_books', ranking }]);
    expect(await screen.findByRole('heading', { name: 'Manuscript specialist' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Choose auction house' })).not.toBeInTheDocument();
  });
  it('shows a chronological sale timeline without upcoming auctions', async () => {
    renderChat([{ id: 'history-test', sessionId: 's1', speaker: 'sale-history', title: 'Previous sales', lots: [soldLotFixture, { ...soldLotFixture, id: 'future-test', status: 'upcoming' }] }]);
    expect(await screen.findByRole('heading', { name: 'Previous sales' })).toBeInTheDocument();
    expect(screen.getByText('Test Auction House · 2025-01-23')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sale details' })).toHaveLength(1);
  });
  it('shows the price trend chart without repeating its sales as item cards', async () => {
    renderChat([{ id: 'trend-test', sessionId: 's1', speaker: 'price-trend', title: 'Price trend',
      lots: [soldLotFixture, { ...soldLotFixture, id: 'second-sale', saleDate: '2026-01-23' }],
      points: [] }]);
    expect(await screen.findByRole('img', { name: /Similar-item sale prices/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: soldLotFixture.title.en })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View original listing' })).not.toBeInTheDocument();
  });
  // Verifies the screen shows the text of the first buyer message in the conversation.
  it('shows the first buyer message', async () => {
    renderChat(mockConversation.en);
    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });

  // Verifies a buyer message and a system message are shown, each tagged with its speaker.
  it('shows a buyer message and a system message tagged by speaker', async () => {
    renderChat(mockConversation.en);
    const buyer = await screen.findByText('I am looking for a mock lot');
    const system = await screen.findByText('Searching for you…');
    expect(buyer.closest('li')).toHaveAttribute('data-speaker', 'buyer');
    expect(system.closest('li')).toHaveAttribute('data-speaker', 'system');
  });

  // Verifies an error message from the conversation is shown and tagged as an error so it stands out.
  it('shows the error message from the conversation tagged as an error', async () => {
    renderChat(mockConversation.en);
    const error = await screen.findByText('Loading results failed. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-speaker', 'error');
  });

  // Verifies a result-group message shows a card for each item.
  it('shows a result group with a card for each item', async () => {
    renderChat(mockConversation.en);
    const card = await screen.findByRole('heading', { name: 'A mock lot' });
    expect(card.closest('li[data-speaker]')).toHaveAttribute('data-speaker', 'result-group');
  });

  // Verifies the title of a result group is shown above its cards.
  it('shows the result group title above its cards', async () => {
    renderChat(
      mockConversation.en.map((message) =>
        message.speaker === 'result-group' ? { ...message, title: 'Upcoming lots' } : message,
      ),
    );
    const title = await screen.findByRole('heading', { name: 'Upcoming lots' });
    const card = screen.getByRole('heading', { name: 'A mock lot' });
    expect(title.closest('li[data-speaker]')).toHaveAttribute('data-speaker', 'result-group');
    expect(title.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // בודק שהודעת no-results (הפלט השני של B3, unmatched demand) מוצגת לקונה עם טקסט ידידותי ומתויגת בקטגוריה שלה.
  it('shows a no-results message from B3 tagged as no-results', async () => {
    renderChat([
      ...mockConversation.en,
      {
        speaker: 'no-results',
        id: 'nr-1',
        sessionId: 'mock-session-en',
        text: 'No matching items were found. Your request has been saved for our team.',
      },
    ]);
    const message = await screen.findByText('No matching items were found. Your request has been saved for our team.');
    expect(message.closest('li')).toHaveAttribute('data-speaker', 'no-results');
  });

  // A no-results message keeps the plain text style of the other assistant lines, with no frame of its own.
  it('shows a no-results message in the same plain style as a system message', async () => {
    renderChat([
      ...mockConversation.en,
      { speaker: 'no-results', id: 'nr-2', sessionId: 'mock-session-en', text: 'No matching items were found.' },
    ]);
    const noResults = (await screen.findByText('No matching items were found.')).closest('li');
    const system = screen.getByText('Searching for you…').closest('li');
    expect(noResults?.className).toBe(system?.className);
    expect(noResults?.className).not.toContain('border');
  });

  // Follow-up "similar items in other categories": the group marked by the server gets the card with the category.
  describe('result group from other categories', () => {
    const groupLots = mockConversation.en.flatMap((message) => (message.speaker === 'result-group' ? message.lots : []));
    const otherCategoriesGroup = (extra: Record<string, unknown> = {}) => ({
      speaker: 'result-group',
      id: 'oc-1',
      sessionId: 'mock-session-en',
      title: 'Past sales',
      lots: groupLots,
      variant: 'other-categories',
      ...extra,
    });

    it('shows the category of each lot, in the buyer language', async () => {
      renderChat([otherCategoriesGroup()]);

      const category = await screen.findByTestId('lot-category');
      expect(category).toHaveTextContent('Rare books');
      expect(category.closest('li[data-speaker]')).toHaveAttribute('data-variant', 'other-categories');
    });

    it('draws each lot with the buyer lot card, one card per lot', async () => {
      const [lot] = groupLots;
      if (!lot) throw new Error('mock conversation has no lot');
      renderChat([otherCategoriesGroup({ lots: [lot, { ...lot, id: 'mock-lot-2', title: { en: 'A second mock lot' } }] })]);

      // The buyer lot card titles a lot with a level-3 heading under the group title; the shared card uses level 2.
      expect(await screen.findByRole('heading', { level: 3, name: 'A mock lot' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'A second mock lot' })).toBeInTheDocument();
      expect(screen.getAllByTestId('lot-category')).toHaveLength(2);
    });

    it('shows a category that has no translation as the data names it', async () => {
      renderChat([otherCategoriesGroup({ lots: groupLots.map((lot) => ({ ...lot, category: 'test_category' })) })]);

      expect(await screen.findByTestId('lot-category')).toHaveTextContent('test category');
    });

    it('shows the match reasons the server sent for a lot', async () => {
      const [lot] = groupLots;
      if (!lot) throw new Error('mock conversation has no lot');
      renderChat([
        otherCategoriesGroup({
          matchReasons: {
            [lot.id]: [
              { field: 'creators', detail: 'Test Maker' },
              { field: 'unlisted_field', detail: 'silver' },
            ],
          },
        }),
      ]);

      expect(await screen.findByText('Creator: Test Maker')).toBeInTheDocument();
      expect(screen.getByText('silver')).toBeInTheDocument();
    });

    it('shows no reasons section when the server sent none', async () => {
      renderChat([otherCategoriesGroup()]);

      await screen.findByTestId('lot-category');
      expect(screen.queryByText('Why this item matches')).not.toBeInTheDocument();
    });

    it('shows the card in Hebrew with Hebrew labels', async () => {
      await i18n.changeLanguage('he');
      renderChat([otherCategoriesGroup()]);

      expect(await screen.findByTestId('lot-category')).toHaveTextContent('ספרים נדירים');
      expect(screen.getByRole('heading', { name: 'פריט לדוגמה' })).toBeInTheDocument();
    });

    it('keeps the regular result group on the shared card, with no category badge or reasons', async () => {
      renderChat(mockConversation.en);

      const title = await screen.findByRole('heading', { level: 2, name: 'A mock lot' });
      expect(title.closest('li[data-speaker]')).not.toHaveAttribute('data-variant');
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
      expect(screen.queryByTestId('lot-category')).not.toBeInTheDocument();
      expect(screen.queryByText('Why this item matches')).not.toBeInTheDocument();
    });

    it('keeps a regular result group on the shared card even when the server sent match reasons with it', async () => {
      const [lot] = groupLots;
      if (!lot) throw new Error('mock conversation has no lot');
      renderChat([
        {
          speaker: 'result-group',
          id: 'rg-1',
          sessionId: 'mock-session-en',
          lots: [lot],
          matchReasons: { [lot.id]: [{ field: 'creators', detail: 'Test Maker' }] },
        },
      ]);

      await screen.findByRole('heading', { level: 2, name: 'A mock lot' });
      expect(screen.queryByTestId('lot-category')).not.toBeInTheDocument();
      expect(screen.queryByText('Creator: Test Maker')).not.toBeInTheDocument();
    });
  });

  // Verifies the conversation is laid out right-to-left when the language is Hebrew.
  it('lays out the conversation RTL in Hebrew', async () => {
    await i18n.changeLanguage('he');
    renderChat(mockConversation.he);
    await screen.findByText('אני מחפשת פריט לדוגמה');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'rtl');
  });

  // Verifies the conversation is laid out left-to-right when the language is English.
  it('lays out the conversation LTR in English', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'ltr');
  });

  // Verifies a long conversation is rendered in full — first and last shown, nothing truncated.
  it('renders a long conversation in full without truncating messages', async () => {
    const longConversation = Array.from({ length: 60 }, (_, index) => ({
      speaker: index % 2 === 0 ? 'buyer' : 'system',
      id: `m-${index + 1}`,
      sessionId: 'mock-session-en',
      ...(index % 2 === 0 ? { skipped: false } : {}),
      text: index % 2 === 0 ? `הודעת קונה ${index + 1}` : `הודעת עוזר ${index + 1}`,
    }));
    renderChat(longConversation);
    expect(await screen.findByText('הודעת קונה 1')).toBeInTheDocument();
    expect(await screen.findByText('הודעת עוזר 60')).toBeInTheDocument();
  });

  // בודק שכל עוד השיחה נטענת מהשרת, המשתמשת רואה חיווי טעינה ואינה יכולה עדיין להקליד או לשלוח.
  it('shows a loading indicator and blocks the composer while the conversation is loading', () => {
    // fetch מזויף שלעולם לא חוזר עם תשובה — מדמה שהשרת עדיין לא ענה.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerChat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Loading conversation…')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  // בודק שכשטעינת השיחה מהשרת נכשלת, המשתמשת רואה הודעת שגיאה וכפתור "נסו שוב".
  it('shows an error message and a retry button when loading the conversation fails', async () => {
    renderChatWithError();
    expect(await screen.findByText("Couldn't load the conversation.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  // בודק שאחרי כשל טעינה, לחיצה על "נסו שוב" מבקשת את השיחה שוב ומציגה אותה.
  it('loads the conversation when the buyer clicks retry after a failure', async () => {
    // הקריאה הראשונה נכשלת (500), וכל קריאה אחריה מצליחה ומחזירה את השיחה — מדמה תקלה זמנית.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValue(new Response(JSON.stringify(mockConversation.en), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerChat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });

  // בודק שבעברית גם שדה הכתיבה וגם תיבת השגיאה מסודרים מימין-לשמאל, כמו שאר המסך.
  it('lays out the composer and the error box RTL in Hebrew', async () => {
    await i18n.changeLanguage('he');
    renderChatWithError();

    const errorBox = await screen.findByRole('alert');
    expect(errorBox).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('textbox').closest('form')).toHaveAttribute('dir', 'rtl');
  });

  // בודק שבעברית סדר האלמנטים במבנה הדף לא מתהפך: שדה הכתיבה לפני כפתור "שליחה", בלי tabindex חיובי,
  // כך שלחיצת Tab עוברת באותו סדר כמו באנגלית (RTL הופך רק את המראה, לא את סדר המקלדת).
  it('keeps the composer keyboard order (input before send) in Hebrew', async () => {
    await i18n.changeLanguage('he');
    renderChat(mockConversation.he);
    await screen.findByText('אני מחפשת פריט לדוגמה');

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: 'שליחה' });

    const inputComesBeforeButton = Boolean(
      input.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(inputComesBeforeButton).toBe(true);
    expect(input.tabIndex).toBeLessThanOrEqual(0);
    expect(sendButton.tabIndex).toBeLessThanOrEqual(0);
  });

  // בודק החלפת שפה תוך כדי שימוש: הקונה לוחץ על כפתור השפה ב-header כשהצ'אט פתוח באנגלית,
  // והמסך עובר לעברית — השיחה נטענת מחדש בעברית, הכיוון מתהפך ל-RTL, הטקסטים מתורגמים,
  // וסדר המקלדת (שדה הכתיבה לפני "שליחה") לא משתנה.
  it('switches the open chat from English LTR to Hebrew RTL when the buyer presses the language button', async () => {
    // השרת המדומה: בקשת שמירת השפה (PATCH) מחזירה פרופיל תקין עם השפה החדשה,
    // וכל בקשה אחרת מחזירה את השיחה בשפה שהתבקשה ב-?language=.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          const { language } = JSON.parse(String(init.body)) as { language: 'he' | 'en' };
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
        const language = new URL(url).searchParams.get('language') === 'he' ? 'he' : 'en';
        return new Response(JSON.stringify(mockConversation[language]), { status: 200 });
      }),
    );
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppHeader />
          <BuyerChat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // לפני ההחלפה: אנגלית, LTR.
    await screen.findByText('I am looking for a mock lot');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'ltr');

    fireEvent.click(screen.getByRole('button', { name: 'עברית' }));

    // אחרי ההחלפה: השיחה בעברית מחליפה את האנגלית, וכל המסך RTL.
    await screen.findByText('אני מחפשת פריט לדוגמה');
    expect(screen.queryByText('I am looking for a mock lot')).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'rtl');
    const input = screen.getByRole('textbox', { name: 'הודעה' });
    expect(input.closest('form')).toHaveAttribute('dir', 'rtl');

    // סדר המקלדת נשמר: שדה הכתיבה עדיין לפני כפתור "שליחה" ב-DOM.
    const sendButton = screen.getByRole('button', { name: 'שליחה' });
    expect(input.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // בודק שכשרענון השיחה נכשל אחרי שכבר יש שיחה על המסך, ההודעות הקיימות והודעת הקונה נשארות,
  // מופיעה תיבת "נסו שוב", ושדה הכתיבה לא נתקע.
  it('keeps the existing conversation and the composer usable when a refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(mockConversation.en), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BuyerChat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText('I am looking for a mock lot');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Any cheaper ones?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('Any cheaper ones?');

    // השרת "נופל" — כל בקשה נוספת נכשלת, ואז מתרחש רענון של השיחה.
    fetchMock.mockResolvedValue(new Response('server error', { status: 500 }));
    await queryClient.refetchQueries({ queryKey: ['buyer-conversation', 'en'] });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the conversation.");
    expect(screen.getByText('I am looking for a mock lot')).toBeInTheDocument();
    expect(screen.getByText('Any cheaper ones?')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  // בודק שכשהקונה מקליד הודעה ולוחץ שליחה, ההודעה מופיעה ברשימת השיחה כהודעת קונה.
  it('adds the typed message to the conversation when the buyer sends it', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const sent = await screen.findByText('Hello there');
    expect(sent.closest('li')).toHaveAttribute('data-speaker', 'buyer');
  });

  // בודק שלחיצה על Enter בשדה שולחת את ההודעה, בלי הכפתור.
  it('sends the message when the buyer presses Enter in the input', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sent with Enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const sent = await screen.findByText('Sent with Enter');
    expect(sent.closest('li')).toHaveAttribute('data-speaker', 'buyer');
  });

  // בודק ש-Shift+Enter לא שולח — ההודעה לא נכנסת לשיחה והטקסט נשאר בשדה.
  it('does not send on Shift+Enter and keeps the draft in the input', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Not sent yet' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(screen.queryByText('Not sent yet', { selector: 'li' })).not.toBeInTheDocument();
    expect(input).toHaveValue('Not sent yet');
  });

  // בודק שאחרי שליחה המיקוד חוזר לשדה ההקלדה, כדי להמשיך להקליד בלי עכבר.
  it('returns focus to the input after sending', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('First', { selector: 'li' });

    expect(input).toHaveFocus();
  });
//callback (onUpdate)
  // בודק שהודעה שנשלחת דרך ה-callback (onUpdate) מוצגת על המסך, מתויגת לפי מי שדיבר.
  it('shows a message that is sent through the callback', async () => {
    vi.mocked(connectLevels).mockImplementation(async (_message, onUpdate) => {
      onUpdate({ speaker: 'system', text: 'Checking results...' });
    });
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Looking for a watch' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const update = await screen.findByText('Checking results...');
    expect(update.closest('li')).toHaveAttribute('data-speaker', 'system');
  });

  // בודק שכל עוד חיבור הרמות עובד (חושב או מחפש) הקונה לא יכול לכתוב או לשלוח, ושהשדה נפתח כשהוא מסיים.
  it('locks the composer while the work is running and unlocks it when it finishes', async () => {
    // ה-Promise נפתר רק כשהבדיקה קוראת ל-finish — מדמה עבודה שעדיין רצה.
    let finish!: () => void;
    vi.mocked(connectLevels).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Looking for a watch' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(screen.getByRole('textbox')).toBeDisabled());
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    await act(async () => finish());

    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  // בודק שכשחיבור הרמות נכשל, הקונה רואה הודעת שגיאה ידידותית בשיחה, והשדה נפתח כדי שיוכל לנסות שוב.
  it('shows an error message and unlocks the composer when the work fails', async () => {
    vi.mocked(connectLevels).mockRejectedValue(new Error('search failed'));
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Looking for a watch' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const error = await screen.findByText('Something went wrong. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-speaker', 'error');
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
