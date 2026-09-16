import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auctionLots';
import { ResultCard } from './ResultCard';

describe('ResultCard', () => {
  it('shows a realized price only for a sold lot', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Realized price')).toBeInTheDocument();
    expect(screen.getByText('USD $1,200')).toBeInTheDocument();
  });

  it('keeps the original currency code visible with sold prices', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getAllByText(/USD/)).not.toHaveLength(0);
  });

  it('does not present an unsold estimate as a realized price', () => {
    render(<ResultCard lot={unsoldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.queryByText('Realized price')).not.toBeInTheDocument();
  });

  it('shows the source status for both sold and unsold lots', () => {
    const { rerender } = render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Status: Sold')).toBeInTheDocument();

    rerender(<ResultCard lot={unsoldLotFixture} lang="en" onSelect={vi.fn()} />);
    expect(screen.getByText('Status: Unsold')).toBeInTheDocument();
  });

  it('renders without an estimate and selects the lot', () => {
    const onSelect = vi.fn();
    render(<ResultCard lot={{ ...soldLotFixture, estimate: undefined }} lang="en" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'View item details' }));
    expect(onSelect).toHaveBeenCalledWith(soldLotFixture.id);
  });

  it('shows the supplied lot image with an accessible description', () => {
    render(
      <ResultCard
        lot={{ ...soldLotFixture, imageUrl: 'https://fixtures.monabid.test/images/lot-1.jpg' }}
        lang="en"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: soldLotFixture.title.en })).toHaveAttribute(
      'src',
      'https://fixtures.monabid.test/images/lot-1.jpg',
    );
  });

  it('shows an honest placeholder when no image is supplied', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'No image available for this lot' })).toBeInTheDocument();
  });

  it('replaces a failed image with the honest placeholder', () => {
    render(
      <ResultCard
        lot={{ ...soldLotFixture, imageUrl: 'https://fixtures.monabid.test/images/missing.jpg' }}
        lang="en"
        onSelect={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: soldLotFixture.title.en }));

    expect(screen.getByRole('img', { name: 'No image available for this lot' })).toBeInTheDocument();
  });

  it('allows the details button to receive keyboard focus', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    const detailsButton = screen.getByRole('button', { name: 'View item details' });
    detailsButton.focus();

    expect(detailsButton).toHaveFocus();
  });

  it('uses right-to-left direction and Hebrew action text for Hebrew', () => {
    render(<ResultCard lot={soldLotFixture} lang="he" onSelect={vi.fn()} />);

    const detailsButton = screen.getByRole('button', { name: 'לפרטי הפריט' });
    expect(detailsButton.closest('article')).toHaveAttribute('dir', 'rtl');
  });
});
