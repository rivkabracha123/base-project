import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { createQueryClient } from './app/query-client';
import i18n from './i18n';

describe('B4 fixture journey', () => {
  it('opens a selected result and shows its exact source evidence', async () => {
    await i18n.changeLanguage('en');
    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/results']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: 'View item details' }))[0]!);

    expect(await screen.findByRole('link', { name: /View Original Lot on Auction Site/ })).toHaveAttribute(
      'href',
      'https://il.bidspirit.com/ui/catalog/auction/kestenbaum/54554?lang=en',
    );
  });
});
