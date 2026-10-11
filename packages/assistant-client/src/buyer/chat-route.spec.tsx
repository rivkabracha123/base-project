import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createQueryClient } from '../app/query-client';
import { mockConversation } from './mock-conversation';
import i18n from '../i18n';

afterEach(() => vi.unstubAllGlobals());

// Verifies the /chat route renders the buyer chat screen.
describe('/chat route', () => {
  // Verifies navigating to /chat renders BuyerChat and shows a message from the conversation.
  it('renders the buyer chat screen at /chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = input.toString();
        const body = url.includes('/buyer-chat/conversation')
          ? mockConversation.en
          : { language: 'en' };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }),
    );
    await i18n.changeLanguage('en');
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/chat']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });
});
