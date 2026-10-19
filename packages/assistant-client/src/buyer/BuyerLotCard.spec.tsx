import type { AuctionLot } from '@monabid/shared';
import { render, screen } from '@testing-library/react';
import { ItemCard } from '@monabid/ui';
import { describe, expect, it } from 'vitest';
import { BuyerLotCard, type BuyerLotCardLabels } from './BuyerLotCard';

const labels: BuyerLotCardLabels = {
  estimate: 'Estimate',
  realized: 'Realized price',
  source: 'View exact source',
  lot: 'Lot',
  matchReasons: 'Why this item matches',
  status: { sold: 'Sold', unsold: 'Unsold', upcoming: 'Upcoming', withdrawn: 'Withdrawn', unknown: 'Status unknown' },
};

// A sold lot with every optional field present.
const fullLot: AuctionLot = {
  id: 'card-lot-1',
  source: {
    provider: 'test-provider',
    recordId: 'card-record-1',
    url: 'https://example.test/lots/card-lot-1',
    retrievedAt: '2026-01-01T00:00:00.000Z',
  },
  auctionHouse: { id: 'test-house', name: 'Test Auction House' },
  auctionTitle: 'Test sale',
  lotNumber: '42',
  title: { en: 'Test silver cup', he: 'גביע כסף לבדיקה' },
  description: { en: 'A test lot description.', he: 'תיאור פריט לבדיקה.' },
  category: 'test_category',
  saleDate: '2025-03-01',
  status: 'sold',
  estimate: { low: { amount: 800, currency: 'USD' }, high: { amount: 1200, currency: 'USD' } },
  realizedPrice: { amount: 1500, currency: 'USD' },
  imageUrl: 'https://example.test/images/card-lot-1.jpg',
};

// The same lot with no image, estimate or realized price.
const bareLot: AuctionLot = {
  ...fullLot,
  id: 'card-lot-2',
  status: 'upcoming',
  estimate: undefined,
  realizedPrice: undefined,
  imageUrl: undefined,
};

describe('BuyerLotCard', () => {
  it('shows the category, title, description, auction house, lot number and status', () => {
    render(<BuyerLotCard lot={fullLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.getByTestId('lot-category')).toHaveTextContent('Test category');
    expect(screen.getByRole('heading', { name: 'Test silver cup' })).toBeInTheDocument();
    expect(screen.getByText('A test lot description.')).toBeInTheDocument();
    expect(screen.getByText('Test Auction House · Lot 42')).toBeInTheDocument();
    expect(screen.getByText('Sold')).toBeInTheDocument();
  });

  it('shows the estimate and the realized price in their original currency', () => {
    render(<BuyerLotCard lot={fullLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.getByText('Estimate').nextElementSibling).toHaveTextContent('$800–$1,200');
    expect(screen.getByText('Realized price').nextElementSibling).toHaveTextContent('$1,500');
  });

  it('links to the exact source of the lot', () => {
    render(<BuyerLotCard lot={fullLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.getByRole('link', { name: 'View exact source' })).toHaveAttribute('href', fullLot.source.url);
  });

  it('shows the lot image when the lot has one', () => {
    render(<BuyerLotCard lot={fullLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.getByRole('img', { name: 'Test silver cup' })).toHaveAttribute('src', fullLot.imageUrl);
  });

  it('leaves out the image and the prices when the lot has none, without placeholders', () => {
    render(<BuyerLotCard lot={bareLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Realized price')).not.toBeInTheDocument();
  });

  it('lists the reasons it was given, label and detail together', () => {
    render(
      <BuyerLotCard
        lot={fullLot}
        locale="en-US"
        labels={labels}
        categoryLabel="Test category"
        reasons={[
          { label: 'Creator', detail: 'Test Maker' },
          { label: '', detail: 'silver' },
          { label: '', detail: '' },
        ]}
      />,
    );

    expect(screen.getByText('Why this item matches')).toBeInTheDocument();
    expect(screen.getByText('Creator: Test Maker')).toBeInTheDocument();
    expect(screen.getByText('silver')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows no reasons section when no reasons were given', () => {
    render(<BuyerLotCard lot={fullLot} locale="en-US" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.queryByText('Why this item matches')).not.toBeInTheDocument();
  });

  // The shared card used by the other screens is untouched: no category badge, image or reasons section.
  it('leaves the shared ItemCard as it was', () => {
    const { status, ...rest } = labels;
    render(<ItemCard lot={fullLot} locale="en-US" labels={{ ...rest, ...status }} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Test silver cup' })).toBeInTheDocument();
    expect(screen.queryByTestId('lot-category')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Why this item matches')).not.toBeInTheDocument();
  });

  it('uses the Hebrew title and description for a Hebrew locale', () => {
    render(<BuyerLotCard lot={fullLot} locale="he-IL" labels={labels} categoryLabel="Test category" reasons={[]} />);

    expect(screen.getByRole('heading', { name: 'גביע כסף לבדיקה' })).toBeInTheDocument();
    expect(screen.getByText('תיאור פריט לבדיקה.')).toBeInTheDocument();
  });
});
