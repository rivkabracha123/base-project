import { auctionLotSchema } from '@monabid/shared';
import type { ItemHistoryLot } from '../components/price-history';
import { resultsSearchOutcomeFixture } from './buyer-search-outcome.fixture';

const itemKey = 'abrabanel_commentary_example';

export const upcomingLotWithHistoryFixture: ItemHistoryLot = {
  ...auctionLotSchema.parse({
    id: 'lot-history-upcoming-001',
    source: {
      provider: 'b4-history-fixture',
      recordId: 'upcoming-001',
      url: 'https://fixtures.monabid.test/lots/upcoming-001',
      retrievedAt: '2026-09-09T00:00:00.000Z',
    },
    auctionHouse: { id: 'history-house', name: 'History Auction House' },
    auctionTitle: 'B4 price history fixture',
    lotNumber: 'H-003',
    title: { en: 'Abrabanel Commentary', he: 'פירוש אברבנאל' },
    description: { en: 'Upcoming lot with source-backed local history.', he: 'לוט עתידי עם היסטוריה מקומית לצורכי בדיקה.' },
    category: 'rare_books',
    saleDate: '2026-11-10',
    status: 'upcoming',
    estimate: {
      low: { amount: 1200, currency: 'USD' },
      high: { amount: 1600, currency: 'USD' },
    },
  }),
  itemKey,
};

const firstHistoricalSale: ItemHistoryLot = {
  ...auctionLotSchema.parse({
    ...upcomingLotWithHistoryFixture,
    id: 'lot-history-sold-001',
    source: {
      provider: 'b4-history-fixture',
      recordId: 'sold-001',
      url: 'https://fixtures.monabid.test/lots/sold-001',
      retrievedAt: '2026-09-09T00:00:00.000Z',
    },
    lotNumber: 'H-001',
    saleDate: '2023-04-12',
    status: 'sold',
    realizedPrice: { amount: 900, currency: 'USD' },
  }),
  itemKey,
};

const secondHistoricalSale: ItemHistoryLot = {
  ...auctionLotSchema.parse({
    ...upcomingLotWithHistoryFixture,
    id: 'lot-history-sold-002',
    source: {
      provider: 'b4-history-fixture',
      recordId: 'sold-002',
      url: 'https://fixtures.monabid.test/lots/sold-002',
      retrievedAt: '2026-09-09T00:00:00.000Z',
    },
    lotNumber: 'H-002',
    saleDate: '2024-11-14',
    status: 'sold',
    realizedPrice: { amount: 1100, currency: 'USD' },
  }),
  itemKey,
};

export const itemHistoryLotFixtures = [
  upcomingLotWithHistoryFixture,
  secondHistoricalSale,
  firstHistoricalSale,
];

const localDemoItemKey = 'atereth_zekeinim_example';

export const localHistoryDemoLotId = 'lot-kestenbaum-54554-121421';

const originalAterethLot = [
  ...resultsSearchOutcomeFixture.results.current,
  ...resultsSearchOutcomeFixture.results.historical,
].map((entry) => entry.lot).find((lot) => lot.id === localHistoryDemoLotId);

if (!originalAterethLot) {
  throw new Error(`Local history demo requires B3 result ${localHistoryDemoLotId}`);
}

// The selected lot stays exactly the B3/P1 fixture; itemKey exists only in local demo data.
export const localHistoryDemoSelectedLot: ItemHistoryLot = {
  ...originalAterethLot,
  itemKey: localDemoItemKey,
};

const firstAterethHistoricalSale: ItemHistoryLot = {
  ...auctionLotSchema.parse({
    ...localHistoryDemoSelectedLot,
    id: 'lot-history-atereth-sold-001',
    source: {
      provider: 'b4-history-fixture',
      recordId: 'atereth-sold-001',
      url: 'https://fixtures.monabid.test/lots/atereth-sold-001',
      retrievedAt: '2026-09-09T00:00:00.000Z',
    },
    saleDate: '2023-04-12',
    status: 'sold',
    realizedPrice: { amount: 900, currency: 'USD' },
  }),
  itemKey: localDemoItemKey,
};

const secondAterethHistoricalSale: ItemHistoryLot = {
  ...auctionLotSchema.parse({
    ...localHistoryDemoSelectedLot,
    id: 'lot-history-atereth-sold-002',
    source: {
      provider: 'b4-history-fixture',
      recordId: 'atereth-sold-002',
      url: 'https://fixtures.monabid.test/lots/atereth-sold-002',
      retrievedAt: '2026-09-09T00:00:00.000Z',
    },
    saleDate: '2024-11-14',
    status: 'sold',
    realizedPrice: { amount: 1100, currency: 'USD' },
  }),
  itemKey: localDemoItemKey,
};

export const localHistoryDemoLots = [
  localHistoryDemoSelectedLot,
  firstAterethHistoricalSale,
  secondAterethHistoricalSale,
];
