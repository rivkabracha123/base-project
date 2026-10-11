import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auction-lots';
import { ResultCard } from './ResultCard';

describe('ResultCard', () => {
  it('shows a realized price only for a sold lot', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Realized price')).toBeInTheDocument();
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0);
  });

  it('shows the sold overlay in the mock form', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Sold for: $1,200')).toBeInTheDocument();
  });

  it('does not present an unsold estimate as a realized price', () => {
    render(<ResultCard lot={unsoldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.queryByText('Realized price')).not.toBeInTheDocument();
  });

  it('does not show a status line on the card', () => {
    const { rerender } = render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.queryByText('Status: Sold')).not.toBeInTheDocument();

    rerender(<ResultCard lot={unsoldLotFixture} lang="en" onSelect={vi.fn()} />);
    expect(screen.queryByText('Status: Unsold')).not.toBeInTheDocument();
  });

  it('renders without an estimate and selects the lot', () => {
    const onSelect = vi.fn();
    render(<ResultCard lot={{ ...soldLotFixture, estimate: undefined }} lang="en" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('heading', { name: soldLotFixture.title.en }));
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

  it('uses the local manuscript image when no lot image is supplied', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByRole('img', { name: soldLotFixture.title.en })).toHaveAttribute('src', '/history-lot.jpg');
  });

  it('replaces a failed image with the local manuscript image', () => {
    render(
      <ResultCard
        lot={{ ...soldLotFixture, imageUrl: 'https://fixtures.monabid.test/images/missing.jpg' }}
        lang="en"
        onSelect={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: soldLotFixture.title.en }));

    expect(screen.getByRole('img', { name: soldLotFixture.title.en })).toHaveAttribute('src', '/history-lot.jpg');
  });

  it('does not render a details button', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'View item details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'לפרטי הפריט' })).not.toBeInTheDocument();
  });

  it('centers the title and keeps Hebrew price labels', () => {
    render(<ResultCard lot={soldLotFixture} lang="he" onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: soldLotFixture.title.en })).toHaveClass('text-center');
    expect(screen.getByText('הערכה')).toBeInTheDocument();
    expect(screen.getByText('נמכר תמורת')).toBeInTheDocument();
    expect(screen.getByText('צפה ברישום המקורי')).toBeInTheDocument();
  });
});
