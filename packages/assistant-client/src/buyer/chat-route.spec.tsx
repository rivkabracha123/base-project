import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import conversationFixture from '../../../../fixtures/demo-scenarios/buyer-conversation.json';
import { App } from '../App';
import { createQueryClient } from '../app/query-client';
import '../i18n';

afterEach(() => vi.unstubAllGlobals());

// Verifies the /chat route renders the buyer chat screen.
describe('/chat route', () => {
  // Verifies navigating to /chat renders BuyerChat and shows a message from the conversation.
  it('renders the buyer chat screen at /chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(conversationFixture.conversations.en), { status: 200 }),
      ),
    );
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/chat']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("I'm looking for rare Hebrew manuscripts, up to $15,000"),
    ).toBeInTheDocument();
  });
});
