import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createQueryClient } from '../app/query-client';
import { mockConversation } from '../buyer/mock-conversation';
import { mockConversation as sellerMockConversation } from '../seller/mock-conversation';
import '../i18n';

afterEach(() => vi.unstubAllGlobals());

// Helper: renders <App/> at a given starting URL, with fetch returning the given response body for any request.
// A new Response is built for every request: a response body can be read only once, and the app now makes more
// than one request on start (the saved profile and the conversation).
function renderAppAt(path: string, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 200 })));
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Verifies the /chat/:role route renders the right chat screen for each role, and that the
// old /chat address still works (redirects to the buyer chat) so no existing link breaks.
// Lives here (not under buyer/ or seller/) because ChatPage itself is the shared routing
// boundary between the two roles, owned by neither.
describe('/chat/:role route', () => {
  // Verifies navigating to /chat/buyer renders BuyerChat and shows a message from the conversation.
  it('renders the buyer chat screen at /chat/buyer', async () => {
    renderAppAt('/chat/buyer', mockConversation.en);
    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });

  // Verifies navigating to /chat/seller renders SellerChat and shows a message from the conversation.
  it('renders the seller chat screen at /chat/seller', async () => {
    renderAppAt('/chat/seller', sellerMockConversation.en);
    expect(await screen.findByText('I have an antique watch I want to sell')).toBeInTheDocument();
  });

  // Verifies the old /chat address (no role) redirects to the buyer chat, so it keeps working.
  it('redirects the old /chat address to the buyer chat', async () => {
    renderAppAt('/chat', mockConversation.en);
    expect(await screen.findByText('I am looking for a mock lot')).toBeInTheDocument();
  });
});
