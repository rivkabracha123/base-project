import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProfileLanguage } from '../app/api';
import { createQueryClient } from '../app/query-client';
import i18n from '../i18n';
import { resources } from '../i18n/resources';
import { AppHeader } from './AppHeader';

vi.mock('../app/api', () => ({
  updateProfileLanguage: vi.fn(),
}));

afterEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('he');
});

describe('AppHeader language control', () => {
  it('changes the displayed language immediately while saving the preference in the background', async () => {
    vi.mocked(updateProfileLanguage).mockResolvedValue({ language: 'en' } as never);
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: resources.he.translation.language }));

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(updateProfileLanguage).toHaveBeenCalledWith('en', expect.anything());
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('provides a persistent link back to the staff dashboard', () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: resources.he.translation.navigation.dashboard })).toHaveAttribute('href', '/staff-operations');
  });
});
