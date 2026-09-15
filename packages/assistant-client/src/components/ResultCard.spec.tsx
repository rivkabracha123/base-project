import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auction-lots';
import { ResultCard } from './ResultCard';

describe('ResultCard', () => {
  it('shows a realized price only for a sold lot', () => {
    render(<ResultCard lot={soldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Realized price')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });

  it('does not present an unsold estimate as a realized price', () => {
    render(<ResultCard lot={unsoldLotFixture} lang="en" onSelect={vi.fn()} />);

    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.queryByText('Realized price')).not.toBeInTheDocument();
  });

  it('renders without an estimate and selects the lot', () => {
    const onSelect = vi.fn();
    render(<ResultCard lot={{ ...soldLotFixture, estimate: undefined }} lang="en" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'View item details' }));
    expect(onSelect).toHaveBeenCalledWith(soldLotFixture.id);
  });
});
