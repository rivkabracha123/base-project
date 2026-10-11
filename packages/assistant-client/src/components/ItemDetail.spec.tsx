import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auction-lots';
import { itemHistoryLotFixtures, upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';
import { ItemDetail } from './ItemDetail';

describe('ItemDetail', () => {
  it('shows original money, realized price, and the exact source for a sold lot', () => {
    render(<ItemDetail lot={soldLotFixture} lang="en" onBack={vi.fn()} />);

    expect(screen.getByText('Original Estimate')).toBeInTheDocument();
    expect(screen.getByText('Realized Price')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', soldLotFixture.source.url);
  });

  it('does not show a realized price for an unsold lot', () => {
    render(<ItemDetail lot={unsoldLotFixture} lang="en" onBack={vi.fn()} />);

    expect(screen.getByText('Original Estimate')).toBeInTheDocument();
    expect(screen.queryByText('Realized Price')).not.toBeInTheDocument();
  });

  it('returns to results when the back button is pressed', () => {
    const onBack = vi.fn();
    render(<ItemDetail lot={soldLotFixture} lang="en" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /Back to Results/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows source-backed price history only when compatible history is supplied', () => {
    render(
      <ItemDetail
        lot={upcomingLotWithHistoryFixture}
        historyLots={itemHistoryLotFixtures}
        lang="en"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sale source' })).toHaveLength(2);
  });

  it('shows an honest price-history empty state when no history is supplied', () => {
    render(<ItemDetail lot={upcomingLotWithHistoryFixture} lang="en" onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There are not enough verified past sales');
    expect(screen.queryByRole('img', { name: 'Price history chart' })).not.toBeInTheDocument();
  });

  it('uses right-to-left direction and Hebrew back text for Hebrew', () => {
    render(<ItemDetail lot={soldLotFixture} lang="he" onBack={vi.fn()} />);

    const backButton = screen.getByRole('button', { name: 'חזרה לתוצאות החיפוש' });
    expect(backButton.closest('div[dir]')).toHaveAttribute('dir', 'rtl');
  });
});
