import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SellerActionCard } from './SellerActionCard';
import { sellerActionResultSchema } from './seller-action-result';
import { upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';

describe('seller action cards', () => {
  it('shows the valuation report without product cards even when comparables are supplied', () => {
    render(<MemoryRouter><SellerActionCard language="en" action={{ kind: 'valuation', status: 'refusal', comparableCount: 1,
      lots: [{ ...upcomingLotWithHistoryFixture, status: 'sold' }] }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Estimated value' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('shows the saved catalog copy without inventing missing facts', () => {
    render(<MemoryRouter><SellerActionCard language="en" action={{ kind: 'catalog', title: 'Seller manuscript', he: '', en: 'Origin not confirmed.' }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Catalog description draft' })).toBeInTheDocument();
    expect(screen.getByText('Origin not confirmed.')).toBeInTheDocument();
  });
  it('shows an editable general enquiry draft and continues to ordinary chat for contact details', () => {
    const action = sellerActionResultSchema.parse({ kind: 'enquiry', draft: {
      evidence: [], item: {
        id: 'seller-item', category: 'rare_books', title: 'Seller manuscript', evidenceIds: [],
        description: { he: 'כתב יד', en: 'Manuscript' }, materials: [],
        dimensions: { values: [{ label: 'width', value: 70, unit: 'mm' }] },
        condition: 'Good condition', source: 'seller-intake', catalogDraft: { he: 'טיוטה', en: 'Draft from confirmed facts' },
      },
    }, enquiryText: 'Dear Sir or Madam, please review this manuscript.', generatedByAi: true });
    const onContinue = vi.fn();
    render(<MemoryRouter><SellerActionCard language="en" action={action} onContinue={onContinue} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Auction enquiry draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chat.itemEdit.edit' })).toBeInTheDocument();
    const draft = screen.getByRole('textbox', { name: 'Enquiry text' });
    expect(draft).toHaveValue('Dear Sir or Madam, please review this manuscript.');
    fireEvent.change(draft, { target: { value: 'Please review this manuscript.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with internal Monabid enquiry' }));
    expect(onContinue).toHaveBeenCalledWith('Please review this manuscript.');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Phone/)).not.toBeInTheDocument();
    expect(screen.queryByText(/To/)).not.toBeInTheDocument();
    expect(screen.getByText('Edit the draft before continuing. The enquiry will be sent to the Monabid team only.')).toBeInTheDocument();
  });
  it('does not show a price for a refused valuation', () => {
    render(<MemoryRouter><SellerActionCard language="en" action={{ kind: 'valuation', status: 'refusal', comparableCount: 0, lots: [] }} /></MemoryRouter>);
    expect(screen.getByText(/No estimated price is shown/)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
