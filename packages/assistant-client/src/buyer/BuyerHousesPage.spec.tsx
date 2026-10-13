import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BuyerHousesPage } from './BuyerHousesPage';
import { rankHouses } from '../app/api';
import i18n from '../i18n';

vi.mock('../app/api', () => ({ rankHouses: vi.fn() }));

describe('buyer house recommendations', () => {
  it('uses buyer category without emitting a seller event or offering seller submission', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(rankHouses).mockResolvedValue({ recommendation: { house: { id: 'h1', name: 'Ring specialist', active: true, categories: ['rings'] } }, alternatives: [] } as never);
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/buyer/houses?category=rings']}><BuyerHousesPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Ring specialist' })).toBeInTheDocument();
    expect(rankHouses).toHaveBeenCalledWith(expect.any(AbortSignal), { category: 'rings', preferredLanguage: 'en' }, false);
    expect(screen.getByRole('link', { name: 'Back to conversation' })).toHaveAttribute('href', '/chat/buyer');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
