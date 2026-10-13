import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { SellerComparisonResults } from './SellerComparisonResults';
import { upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';
import { sellerMessageSchema } from './messages';

const sold = { ...upcomingLotWithHistoryFixture, id: 'sold-1', status: 'sold' as const, saleDate: '2024-01-01', realizedPrice: { amount: 100, currency: 'USD' } };
describe('seller comparison results', () => {
  it('renders the seller own item as a card without invented sale data or links', () => {
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'details', item: {
      title: 'My blue ring', category: 'rings', description: { en: 'Silver ring' }, materials: ['silver'],
      dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] }, condition: 'Good', signatures: 'AB',
    } } as never} /></MemoryRouter>);
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My blue ring' })).toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('Temporary demo image')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sold for|Estimate/)).not.toBeInTheDocument();
  });
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  it.each(['search', 'history'] as const)('filters mixed records for %s and renders shared cards', mode => {
    const upcoming = { ...sold, id: 'future', title: { en: 'Future ring' }, status: 'upcoming' as const };
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode, criteria: { category: 'rings' }, lots: [sold, upcoming] }} /></MemoryRouter>);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: mode === 'search' ? 'Future ring' : sold.title.en })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: mode === 'search' ? sold.title.en : 'Future ring' })).not.toBeInTheDocument();
  });
  it('keeps the structured comparison through chat validation', () => {
    const comparison = { mode: 'history', criteria: { category: 'rare_books' }, lots: [sold] };
    expect(sellerMessageSchema.parse({ id: 'm1', sessionId: 's1', speaker: 'system', text: 'Past sales', comparison })).toMatchObject({ comparison });
  });
  it('draws separate currency graphs and labels demo data without appending item details', () => {
    const lots = [sold, { ...sold, id: 'sold-2', saleDate: '2025-01-01', source: { ...sold.source, provider: 'synthetic-development-demo' }, realizedPrice: { amount: 200, currency: 'USD' } },
      { ...sold, id: 'eur-1', realizedPrice: { amount: 50, currency: 'EUR' } }, { ...sold, id: 'eur-2', realizedPrice: { amount: 80, currency: 'EUR' } }];
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'trend', criteria: { category: 'rare_books' }, lots }} /></MemoryRouter>);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Similar-item sale prices (USD)' }).querySelector('polyline')).toHaveAttribute('points');
    expect(screen.getByText('DEMO data only')).toBeInTheDocument();
    expect(screen.getByText(/not your item's sale history/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(sold.description.en)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Similar-item sale prices (USD)' })).toHaveAttribute('direction', 'ltr');
  });
  it('shows previous sales with details and source links but no graph', () => {
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'history', criteria: { category: 'rare_books' }, lots: [sold] }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: sold.title.en })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View original listing' })).toHaveAttribute('href', sold.source.url);
    expect(screen.getByRole('img', { name: sold.title.en })).toHaveAttribute('src', '/history-lot.jpg');
    expect(screen.queryByRole('img', { name: /Similar-item sale prices/ })).not.toBeInTheDocument();
  });
  it('does not connect prices in different currencies into one trend', () => {
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'trend', criteria: { category: 'rare_books' }, lots: [sold, { ...sold, id: 'eur', realizedPrice: { amount: 80, currency: 'EUR' } }] }} /></MemoryRouter>);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Not enough completed sales');
  });
  it('shows an empty state in Hebrew', () => {
    render(<MemoryRouter><SellerComparisonResults language="he" result={{ mode: 'history', criteria: { category: 'rings' }, lots: [] }} /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05de\u05ea\u05d0\u05d9\u05de\u05d5\u05ea');
  });
});
