import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { SellerChat } from './SellerChat';
import { connectSellerLevels } from './connect-seller-levels';
import { mockConversation } from './mock-conversation';
import i18n from '../i18n';

// Tests for the seller chat screen — mirrors buyer/BuyerChat.spec.tsx for the SellerChat/ChatScreen pair.

// חיבור רמות מזויף של המוכר: הבדיקות שולטות במה שהוא שולח ל-callback ובמתי הוא מסיים.
vi.mock('./connect-seller-levels', () => ({ connectSellerLevels: vi.fn() }));

afterEach(async () => {
  vi.mocked(connectSellerLevels).mockReset();
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
      <SellerChat />
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
      <SellerChat />
    </QueryClientProvider>,
  );
}

describe('SellerChat', () => {
  it('shows the first seller message', async () => {
    renderChat(mockConversation.en);
    expect(await screen.findByText('I have an antique watch I want to sell')).toBeInTheDocument();
  });

  it('shows a seller message and a system message tagged by speaker', async () => {
    renderChat(mockConversation.en);
    const seller = await screen.findByText('I have an antique watch I want to sell');
    const system = await screen.findByText('Could you upload a photo and describe its condition?');
    expect(seller.closest('li')).toHaveAttribute('data-speaker', 'seller');
    expect(system.closest('li')).toHaveAttribute('data-speaker', 'system');
  });

  it('shows the error message from the conversation tagged as an error', async () => {
    renderChat(mockConversation.en);
    const error = await screen.findByText('Saving the details failed. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-speaker', 'error');
  });

  it('lays out the conversation RTL in Hebrew', async () => {
    await i18n.changeLanguage('he');
    renderChat(mockConversation.he);
    await screen.findByText('יש לי שעון עתיק שאני רוצה למכור');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'rtl');
  });

  it('lays out the conversation LTR in English', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'ltr');
  });

  it('shows a loading indicator and blocks the composer while the conversation is loading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SellerChat />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Loading conversation…')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows an error message and a retry button when loading the conversation fails', async () => {
    renderChatWithError();
    expect(await screen.findByText("Couldn't load the conversation.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('loads the conversation when the seller clicks retry after a failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValue(new Response(JSON.stringify(mockConversation.en), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={queryClient}>
        <SellerChat />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText('I have an antique watch I want to sell')).toBeInTheDocument();
  });

  it('adds the typed message to the conversation when the seller sends it', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'It is in great condition' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const sent = await screen.findByText('It is in great condition');
    expect(sent.closest('li')).toHaveAttribute('data-speaker', 'seller');
  });

  it('sends the message when the seller presses Enter in the input', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sent with Enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const sent = await screen.findByText('Sent with Enter');
    expect(sent.closest('li')).toHaveAttribute('data-speaker', 'seller');
  });

  it('does not send on Shift+Enter and keeps the draft in the input', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Not sent yet' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(screen.queryByText('Not sent yet', { selector: 'li' })).not.toBeInTheDocument();
    expect(input).toHaveValue('Not sent yet');
  });

  it('returns focus to the input after sending', async () => {
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByText('First', { selector: 'li' });

    expect(input).toHaveFocus();
  });

  // בודק שהודעה שנשלחת דרך ה-callback (onUpdate) מוצגת אצל המוכר, מתויגת לפי מי שדיבר.
  it('shows a message that is sent through the callback', async () => {
    vi.mocked(connectSellerLevels).mockImplementation(async (_message, onUpdate) => {
      onUpdate({ speaker: 'system', text: 'Checking the details...' });
    });
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'It is in great condition' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const update = await screen.findByText('Checking the details...');
    expect(update.closest('li')).toHaveAttribute('data-speaker', 'system');
  });

  // בודק שכל עוד החיבור עובד המוכר לא יכול לכתוב או לשלוח, ושהשדה נפתח כשהוא מסיים.
  it('locks the composer while the work is running and unlocks it when it finishes', async () => {
    let finish!: () => void;
    vi.mocked(connectSellerLevels).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'It is in great condition' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(screen.getByRole('textbox')).toBeDisabled());
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    await act(async () => finish());

    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  // בודק שכשהחיבור נכשל, המוכר רואה הודעת שגיאה ידידותית בשיחה, והשדה נפתח כדי שיוכל לנסות שוב.
  it('shows an error message and unlocks the composer when the work fails', async () => {
    vi.mocked(connectSellerLevels).mockRejectedValue(new Error('saving failed'));
    renderChat(mockConversation.en);
    await screen.findByText('I have an antique watch I want to sell');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'It is in great condition' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const error = await screen.findByText('Something went wrong. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-speaker', 'error');
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
