import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppHeader } from './AppHeader';
import '../i18n';

// Verifies the header offers a way into both chat roles without typing a URL.
describe('AppHeader', () => {
  it('links to the buyer chat at /chat/buyer', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Find an item' })).toHaveAttribute('href', '/chat/buyer');
  });

  it('links to the seller chat at /chat/seller', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Sell an item' })).toHaveAttribute('href', '/chat/seller');
  });
});
