import {
  preparedAuctionHouseFixtureSchema,
  type PreparedAuctionHouse,
} from '@monabid/shared';

export function loadPreparedHouses(): PreparedAuctionHouse[] {
  return preparedAuctionHouseFixtureSchema.parse([
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
    {
      id: 'house-kedem',
      name: 'Kedem Auction House',
      active: true,
      categories: ['judaica', 'rare_books'],
      geography: 'Israel',
      languages: ['he', 'en'],
      recentSaleDate: '2024-11-12',
      comparableSoldCountByCategory: { judaica: 3, rare_books: 1 },
    },
    {
      id: 'house-judaica-specialist',
      name: 'Prepared Judaica House',
      active: true,
      categories: ['judaica'],
      geography: 'Israel',
      languages: ['he'],
      recentSaleDate: '2023-06-01',
      comparableSoldCountByCategory: { judaica: 2 },
    },
    {
      id: 'house-inactive-demo',
      name: 'Inactive Prepared House',
      active: false,
      categories: ['rare_books'],
      geography: 'United States',
      languages: ['en'],
      recentSaleDate: '2025-06-01',
      comparableSoldCountByCategory: { rare_books: 9 },
    },
  ]);
}
