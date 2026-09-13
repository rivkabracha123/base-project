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
  it('shows the chart, original prices, and a source for each historical sale', () => {
    const sales = getComparableSaleHistory(upcomingLotWithHistoryFixture, itemHistoryLotFixtures);
    render(<PriceHistory sales={sales} lang="en" />);

    const chart = screen.getByRole('img', { name: 'Price history chart' });
    const labels = Array.from(chart.querySelectorAll('text')).map((label) => label.textContent);

    expect(chart).toBeInTheDocument();
    expect(labels).toEqual(expect.arrayContaining(['USD $900', 'USD $1,100', 'Apr 2023', 'Nov 2024']));
    expect(screen.getAllByRole('link', { name: 'Sale source' })).toHaveLength(2);
  });

  it('shows an honest empty state instead of a chart when fewer than two valid sales are available', () => {
    render(<PriceHistory sales={[]} lang="en" />);

    expect(screen.getByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There are not enough verified past sales');
    expect(screen.queryByRole('img', { name: 'Price history chart' })).not.toBeInTheDocument();
  });
});
