import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../app/query-client';
import { AppHeader } from './AppHeader';
import '../i18n';

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
});
