import {
  auctionLotFixtureSchema,
  preparedAuctionHouseFixtureSchema,
} from '@monabid/shared';

export const demoCategories = [
  { category: 'rings', title: 'blue silver ring size 8', medium: 'silver' },
  { category: 'jewelry', title: 'gold necklace', medium: 'gold' },
  { category: 'rare_books', title: 'antique Hebrew manuscript', medium: 'paper' },
  { category: 'judaica', title: 'silver ceremonial cup', medium: 'silver' },
  { category: 'paintings', title: 'landscape oil painting on canvas', medium: 'oil_canvas' },
  { category: 'furniture', title: 'antique oak chair', medium: 'wood' },
  { category: 'watches', title: 'vintage steel wristwatch', medium: 'steel' },
];

export function chatDemoHouses() {
  return preparedAuctionHouseFixtureSchema.parse(demoCategories.flatMap(({ category }) =>
    [1, 2].map(number => ({
      id: `demo-house-${category}-${number}`,
      name: `DEMO ONLY - ${category} auction house ${number} (fictional)`,
      active: true, categories: [category], geography: 'israel', languages: ['he', 'en'],
      recentSaleDate: '2026-09-01', comparableSoldCountByCategory: { [category]: 3 },
    })),
  ));
}

export function chatDemoLots() {
  return auctionLotFixtureSchema.parse(demoCategories.flatMap(({ category, title, medium }) =>
    [0, 1, 2, 3].map(index => ({
      id: `demo-coverage-${category}-${index + 1}`,
      itemKey: `demo_coverage_${category}_same_item`,
      source: {
        provider: 'synthetic-development-demo', recordId: `coverage-${category}-${index + 1}`,
        url: `https://example.test/demo/${category}/${index + 1}`,
        retrievedAt: '2026-10-11T00:00:00.000Z',
      },
      auctionHouse: {
        id: `demo-house-${category}-1`,
        name: `DEMO ONLY - ${category} auction house 1 (fictional)`,
      },
      auctionTitle: 'DEMO ONLY - fabricated sales, not market evidence',
      lotNumber: String(index + 1), title: { en: `DEMO ${title}` },
      imageUrl: 'http://127.0.0.1:5173/history-lot.jpg',
      description: { en: `DEMO ONLY. Fictional ${title}; ${medium}, good condition. Prices and sales are fabricated for local testing.` },
      category, geography: 'israel', medium,
      saleDate: ['2024-04-12', '2025-06-14', '2026-09-01', '2026-12-01'][index]!,
      status: index === 3 ? 'upcoming' : 'sold',
      estimate: { low: { amount: 180, currency: 'USD' }, high: { amount: 240, currency: 'USD' } },
      ...(index < 3 ? { realizedPrice: { amount: [200, 210, 220][index]!, currency: 'USD' } } : {}),
    })),
  ));
}
