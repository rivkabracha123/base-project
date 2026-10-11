import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { itemHistoryLotFixtures, upcomingLotWithHistoryFixture } from '../app/local-history-demo.fixture';
import i18n from '../i18n';
import { PriceHistory } from './PriceHistory';
import { getComparableSaleHistory } from './price-history';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

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

    expect(screen.getByText('$900')).toBeInTheDocument();
    expect(screen.getByText('$1,100')).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /History Auction House · 2024/ })).toHaveAttribute('href', sales[1].source.url);
    expect(screen.getByRole('img', { name: sales[1].title.en })).toHaveAttribute('src', '/history-lot.jpg');
    expect(screen.queryByText('Looking for earlier appearances of this item…')).not.toBeInTheDocument();
  });

  it('shows the searching status only while the backend history search is in progress', async () => {
    await i18n.changeLanguage('en');
    render(<PriceHistory sales={[]} lang="en" loading />);

    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('history.searching'));
  });

  it('shows an honest empty state instead of a chart when fewer than two valid sales are available', () => {
    render(<PriceHistory sales={[]} lang="en" />);

    expect(screen.getByRole('heading', { name: 'Price History' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('There are not enough verified past sales');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
