import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
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
  it('previews an enquiry and links to explicit review without submitting', () => {
    const action = sellerActionResultSchema.parse({ kind: 'enquiry', draft: {
      evidence: [], item: { id: 'seller-item', category: 'rare_books', title: 'Seller manuscript', evidenceIds: [], catalogDraft: { he: 'טיוטה', en: 'Draft from confirmed facts' } },
    }, ranking: { recommendation: null, alternatives: [], excluded: [] } });
    render(<MemoryRouter><SellerActionCard language="en" action={action} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Review and confirm enquiry' })).toHaveAttribute('href', '/seller/enquiry');
    expect(screen.getByText('The draft has not been sent to the auction house.')).toBeInTheDocument();
  });
  it('does not show a price for a refused valuation', () => {
    render(<MemoryRouter><SellerActionCard language="en" action={{ kind: 'valuation', status: 'refusal', comparableCount: 0, lots: [] }} /></MemoryRouter>);
    expect(screen.getByText(/No estimated price is shown/)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
