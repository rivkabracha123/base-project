import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { BuyerChat } from './BuyerChat';
import { mockConversation } from './mock-conversation';
import i18n from '../i18n';

//רץ אחרי כל בדיקה מבטל mocks ומחזיר לשפה אנגלית
afterEach(async () => {
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
      <BuyerChat />
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
      <BuyerChat />
    </QueryClientProvider>,
  );
}

// Tests for the buyer chat screen.
describe('BuyerChat', () => {
  // Verifies the screen shows the text of the first buyer message in the conversation.
  it('shows the first buyer message', async () => {
    renderChat(mockConversation.en);
    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });

  // Verifies a buyer message and an assistant message are shown, each tagged with its kind.
  it('shows a buyer message and an assistant message tagged by kind', async () => {
    renderChat(mockConversation.en);
    const buyer = await screen.findByText('I am looking for a mock lot');
    const assistant = await screen.findByText('Searching for you…');
    expect(buyer.closest('li')).toHaveAttribute('data-kind', 'buyer');
    expect(assistant.closest('li')).toHaveAttribute('data-kind', 'assistant');
  });

  // Verifies an error message from the conversation is shown and tagged as an error so it stands out.
  it('shows the error message from the conversation tagged as an error', async () => {
    renderChat(mockConversation.en);
    const error = await screen.findByText('Loading results failed. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-kind', 'error');
  });

  // Verifies a result-group message shows a title and a card for each item.
  it('shows a result group with a card for each item', async () => {
    renderChat(mockConversation.en);
    expect(await screen.findByText('Nearby lots')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'A mock lot' })).toBeInTheDocument();
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
      kind: index % 2 === 0 ? 'buyer' : 'assistant',
      id: `m-${index + 1}`,
      at: '2026-01-01T10:00:00.000Z',
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
        <BuyerChat />
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
        <BuyerChat />
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
        <BuyerChat />
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
    expect(sent.closest('li')).toHaveAttribute('data-kind', 'buyer');
  });

  // בודק שלחיצה על Enter בשדה שולחת את ההודעה, בלי הכפתור.
  it('sends the message when the buyer presses Enter in the input', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I am looking for a mock lot');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sent with Enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const sent = await screen.findByText('Sent with Enter');
    expect(sent.closest('li')).toHaveAttribute('data-kind', 'buyer');
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
});
