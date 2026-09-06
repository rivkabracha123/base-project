import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLotById } from './api';

const lot = {
  id: 'lot-1',
  source: { provider: 'fixture', recordId: '1', url: 'https://example.com/source', retrievedAt: '2025-01-01T00:00:00.000Z' },
  auctionHouse: { id: 'house-1', name: 'Example House' },
  auctionTitle: 'Auction',
  lotNumber: '1',
  title: { en: 'Source-backed lot' },
  description: { en: 'Description' },
  category: 'books',
  saleDate: '2025-01-01',
  status: 'sold',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});


describe('getLotById', () => {
  it('returns a validated lot when the API finds the requested id', async () => {
    vi.stubEnv('VITE_FIXTURE_MODE', 'false');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(lot), { status: 200 })));

    await expect(getLotById('lot-1', 'en')).resolves.toEqual(lot);
  });

  it('throws when the API cannot find the requested id', async () => {
    vi.stubEnv('VITE_FIXTURE_MODE', 'false');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(getLotById('missing', 'en')).rejects.toThrow('API request failed with status 404');
  });
});
