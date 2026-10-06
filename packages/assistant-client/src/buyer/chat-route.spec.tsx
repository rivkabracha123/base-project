import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createQueryClient } from '../app/query-client';
import { mockConversation } from './mock-conversation';
import '../i18n';

afterEach(() => vi.unstubAllGlobals());

// Verifies the /chat route renders the buyer chat screen.
describe('/chat route', () => {
  // Verifies navigating to /chat renders BuyerChat and shows a message from the conversation.
  it('renders the buyer chat screen at /chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify(mockConversation.en), { status: 200 })),
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

    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });
});
