import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auction-lots';
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
});
