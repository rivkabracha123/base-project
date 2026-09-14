import { describe, expect, it } from 'vitest';
import { preparedAuctionHouseFixtureSchema } from './house-recommendation';

describe('preparedAuctionHouseFixtureSchema', () => {
  it('accepts the prepared active-house fixture', () => {
    const houses = [
      {
        id: 'house-kestenbaum',
        name: 'Kestenbaum & Company',
        active: true,
        categories: ['rare_books'],
        geography: 'United States',
        languages: ['en'],
        recentSaleDate: '2025-01-23',
        comparableSoldCountByCategory: { rare_books: 4 },
      },
    ];

    expect(preparedAuctionHouseFixtureSchema.parse(houses)).toHaveLength(houses.length);
  });
});
