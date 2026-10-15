import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { SellerComparisonResults } from './SellerComparisonResults';
import { correctSellerDraftField } from './connect-seller-correction';
import { upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';
import { sellerMessageSchema } from './messages';

vi.mock('./connect-seller-correction', () => ({ correctSellerDraftField: vi.fn() }));

const sold = { ...upcomingLotWithHistoryFixture, id: 'sold-1', status: 'sold' as const, saleDate: '2024-01-01', realizedPrice: { amount: 100, currency: 'USD' } };
describe('seller comparison results', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(correctSellerDraftField).mockReset();
  });

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

  it('edits every displayed field in the active language and persists only that language', async () => {
    const item = {
      title: 'My blue ring', category: 'rings', description: { he: 'תיאור מקורי', en: 'Original description' }, materials: ['silver'],
      dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] }, condition: 'Good', markings: 'Initial mark',
      signatures: 'AB', provenance: 'Family collection',
    };
    const savedItem = { ...item, titleTranslations: { he: 'My blue ring', en: 'My blue ring' } };
    vi.mocked(correctSellerDraftField).mockImplementation(async (field, value) => {
      if (field === 'title') {
        const localized = value as { he?: string; en?: string };
        savedItem.titleTranslations = { ...savedItem.titleTranslations, ...localized };
        savedItem.title = localized.en ?? localized.he ?? savedItem.title;
      } else if (field === 'description') {
        savedItem.description = { ...savedItem.description, ...(value as { he?: string; en?: string }) };
      } else if (field === 'category') savedItem.category = value as string;
      else if (field === 'materials') savedItem.materials = value as string[];
      else if (field === 'dimensions') savedItem.dimensions = value as typeof item.dimensions;
      else if (field === 'condition') savedItem.condition = value as string;
      else if (field === 'marks') savedItem.markings = value as string;
      else if (field === 'signatures') savedItem.signatures = value as string;
      else if (field === 'provenance') savedItem.provenance = value as string;
      return { item: savedItem } as never;
    });
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'details', item } as never} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.queryByLabelText('כותרת')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated title' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'jewelry' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Updated description' } });
    fireEvent.change(screen.getByLabelText('Materials'), { target: { value: 'gold, wood' } });
    fireEvent.change(screen.getByLabelText('Dimensions'), { target: { value: 'size: 9 ring_size' } });
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Very good' } });
    fireEvent.change(screen.getByLabelText('Marks and inscriptions'), { target: { value: 'Updated mark' } });
    fireEvent.change(screen.getByLabelText('Signatures'), { target: { value: 'CD' } });
    fireEvent.change(screen.getByLabelText('Provenance and ownership history'), { target: { value: 'Estate sale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(correctSellerDraftField).toHaveBeenCalledTimes(9));
    expect(correctSellerDraftField).toHaveBeenNthCalledWith(1, 'title', { en: 'Updated title' });
    expect(correctSellerDraftField).toHaveBeenNthCalledWith(2, 'category', 'jewelry');
    expect(correctSellerDraftField).toHaveBeenNthCalledWith(3, 'description', { en: 'Updated description' });
    expect(correctSellerDraftField).toHaveBeenNthCalledWith(4, 'materials', ['gold', 'wood']);
    expect(correctSellerDraftField).toHaveBeenNthCalledWith(5, 'dimensions', { values: [{ label: 'size', value: 9, unit: 'ring_size' }] });
    expect(savedItem.description.he).toBe('תיאור מקורי');
    expect(await screen.findByRole('heading', { name: 'Updated title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit item' })).toBeInTheDocument();
  });

  it('shows a save error and keeps the edit form open when the correction API fails', async () => {
    vi.mocked(correctSellerDraftField).mockRejectedValue(new Error('Request failed'));
    render(<MemoryRouter><SellerComparisonResults language="en" result={{ mode: 'details', item: {
      title: 'My blue ring', category: 'rings', description: { he: 'תיאור', en: 'Description' }, materials: [],
      dimensions: { values: [] },
    } } as never} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Another ring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows Hebrew edit fields and sends only the Hebrew locale', async () => {
    await i18n.changeLanguage('he');
    const item = {
      title: 'My blue ring', titleTranslations: { he: 'טבעת כחולה', en: 'My blue ring' },
      category: 'rings', description: { he: 'טבעת כסף', en: 'Silver ring' }, materials: ['silver'],
      dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] },
    };
    vi.mocked(correctSellerDraftField).mockResolvedValue({ item: { ...item, title: 'טבעת מעודכנת',
      titleTranslations: { he: 'טבעת מעודכנת', en: 'My blue ring' } } } as never);
    render(<MemoryRouter><SellerComparisonResults language="he" result={{ mode: 'details', item: {
      title: 'My blue ring', titleTranslations: { he: 'טבעת כחולה', en: 'My blue ring' },
      category: 'rings', description: { he: 'טבעת כסף', en: 'Silver ring' }, materials: ['silver'],
      dimensions: { values: [{ label: 'size', value: 8, unit: 'ring_size' }] },
    } } as never} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'עריכת פריט' }));
    expect(screen.getByLabelText('כותרת')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('כותרת'), { target: { value: 'טבעת מעודכנת' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(correctSellerDraftField).toHaveBeenCalledWith('title', { he: 'טבעת מעודכנת' }));
  });

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
