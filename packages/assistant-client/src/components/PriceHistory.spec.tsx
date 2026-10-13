import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { itemHistoryLotFixtures, upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';
import { PriceHistory } from './PriceHistory';
import { getComparableSaleHistory } from './price-history';

describe('getComparableSaleHistory', () => {
  it('keeps only sold records of the same item and currency in date order', () => {
    const sales = getComparableSaleHistory(upcomingLotWithHistoryFixture, itemHistoryLotFixtures);

    expect(sales.map((sale) => sale.id)).toEqual(['lot-history-sold-001', 'lot-history-sold-002']);
  });
});

describe('PriceHistory', () => {
  it('shows verified past sales, their prices, and the latest-sale source', () => {
    const sales = getComparableSaleHistory(upcomingLotWithHistoryFixture, itemHistoryLotFixtures);
    render(<PriceHistory sales={sales} lang="en" />);

    expect(screen.getByText('USD $900')).toBeInTheDocument();
    expect(screen.getByText('USD $1,100')).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View sale record' })).toHaveAttribute('href', sales[1]!.source.url);
  });

  it('shows an honest empty state instead of a chart when fewer than two valid sales are available', () => {
    render(<PriceHistory sales={[]} lang="en" />);

    expect(screen.getByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There are not enough verified past sales');
    expect(screen.queryByRole('link', { name: 'View sale record' })).not.toBeInTheDocument();
  });
});
