import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import conversationFixture from '../../../../fixtures/demo-scenarios/buyer-conversation.json';
import { createQueryClient } from '../app/query-client';
import { BuyerChat } from './BuyerChat';
import i18n from '../i18n';

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

// Tests for the buyer chat screen.
describe('BuyerChat', () => {
  // Verifies the screen shows the text of the first buyer message in the conversation.
  it('shows the first buyer message', async () => {
    renderChat(conversationFixture.conversations.en);
    expect(
      await screen.findByText("I'm looking for rare Hebrew manuscripts, up to $15,000"),
    ).toBeInTheDocument();
  });

  // Verifies a buyer message and an assistant message are shown, each tagged with its kind.
  it('shows a buyer message and an assistant message tagged by kind', async () => {
    renderChat(conversationFixture.conversations.en);
    const buyer = await screen.findByText("I'm looking for rare Hebrew manuscripts, up to $15,000");
    const assistant = await screen.findByText('Searching the historical archive…');
    expect(buyer.closest('li')).toHaveAttribute('data-kind', 'buyer');
    expect(assistant.closest('li')).toHaveAttribute('data-kind', 'assistant');
  });

  // Verifies an error message from the conversation is shown and tagged as an error so it stands out.
  it('shows the error message from the conversation tagged as an error', async () => {
    renderChat(conversationFixture.conversations.en);
    const error = await screen.findByText('Loading results failed. Please try again.');
    expect(error.closest('li')).toHaveAttribute('data-kind', 'error');
  });

  // Verifies a result-group message shows a title and a card for each item.
  it('shows a result group with a card for each item', async () => {
    renderChat(conversationFixture.conversations.en);
    expect(await screen.findByText('Nearby lots')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Atereth Zekeinim by Yitzhak Abrabanel' }),
    ).toBeInTheDocument();
  });

  // Verifies the conversation is laid out right-to-left when the language is Hebrew.
  it('lays out the conversation RTL in Hebrew', async () => {
    await i18n.changeLanguage('he');
    renderChat(conversationFixture.conversations.he);
    await screen.findByText('אני מחפשת כתבי יד עבריים נדירים, עד 15,000 דולר');
    expect(screen.getByRole('log')).toHaveAttribute('dir', 'rtl');
  });

  // Verifies the conversation is laid out left-to-right when the language is English.
  it('lays out the conversation LTR in English', async () => {
    renderChat(conversationFixture.conversations.en);
    await screen.findByText("I'm looking for rare Hebrew manuscripts, up to $15,000");
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
});
