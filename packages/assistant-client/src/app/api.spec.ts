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
import { mockConversation } from '../buyer/mock-conversation';
import { getConversation } from './api';

afterEach(() => vi.unstubAllGlobals());

// Tests for getConversation — fetches a conversation from the backend and validates it.
describe('getConversation', () => {
  // Verifies it fetches a bilingual conversation, returns it unchanged, and calls the right URL with the language param.
  it('fetches and validates a real bilingual conversation from the backend', async () => {
    const sample = mockConversation.he;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual(sample);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/chat/conversation?language=he',
      expect.objectContaining({ signal: undefined }),
    );
  });

  // Verifies invalid messages returned by the API are dropped before they reach the rest of the code.
  it('drops any invalid messages returned by the API before exposing them', async () => {
    const validMessage = {
      kind: 'buyer',
      id: 'incoming-1',
      at: '2026-01-01T10:00:00.000Z',
      text: 'שלום',
    };
    const responseBody = [
      { kind: 'banana', id: 'bad-1', at: '2026-01-01T10:00:01.000Z', text: 'x' },
      validMessage,
      { kind: 'assistant', id: 'bad-2', at: '2026-01-01T10:00:02.000Z' },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual([validMessage]);
  });
});
