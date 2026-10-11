import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockConversation } from '../buyer/mock-conversation';
import { generateAi, getAnonymousSessionId, getConversation, getLotById, getLotSaleHistory } from './api';

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
  localStorage.clear();
});

describe('generateAi routing responses', () => {
  it.each([
    ['search_auction_lots', 'searchLots'],
    ['buyer_house_ranking', 'rankSellerHouses'],
  ])('accepts backend route %s with function %s', async (intent, functionName) => {
    localStorage.setItem('anonymousSessionId', 'test-session');
    const response = {
      provider: 'real', mode: 'real', isRelevant: true, error: null,
      content: '{}', summary: 'Summary', recommendation: 'Recommendation',
      nextAction: 'Next action', confidence: 'medium', structuredAnswer: {},
      intentRoute: { intent, functionName, readyForFunction: false, missingFields: ['category'], arguments: {} },
      conversationId: '11111111-1111-4111-8111-111111111111',
      exchangeId: '22222222-2222-4222-8222-222222222222',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));

    await expect(generateAi('Find a blue ring', 'buyer', 'en')).resolves.toEqual(response);
  });
});

describe('getAnonymousSessionId', () => {
  it('creates and saves an identifier for a new browser', () => {
    const randomUUID = vi.fn(() => 'new-test-session-id');
    vi.stubGlobal('crypto', { randomUUID });

    const sessionId = getAnonymousSessionId();

    expect(sessionId).toBe('new-test-session-id');
    expect(localStorage.getItem('anonymousSessionId')).toBe('new-test-session-id');
  });

  it('reuses an identifier already saved in the browser', () => {
    localStorage.setItem('anonymousSessionId', 'saved-test-session-id');
    const randomUUID = vi.fn(() => 'replacement-session-id');
    vi.stubGlobal('crypto', { randomUUID });

    const sessionId = getAnonymousSessionId();

    expect(sessionId).toBe('saved-test-session-id');
    expect(randomUUID).not.toHaveBeenCalled();
  });
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

describe('getLotSaleHistory', () => {
  it('returns validated historical sales for an itemKey', async () => {
    vi.stubEnv('VITE_FIXTURE_MODE', 'false');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([lot]), { status: 200 })));

    await expect(getLotSaleHistory('abrabanel_commentary')).resolves.toEqual([lot]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/lots/history/abrabanel_commentary',
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('returns an empty list in fixture mode instead of inventing sales', async () => {
    vi.stubEnv('VITE_FIXTURE_MODE', 'true');

    await expect(getLotSaleHistory('abrabanel_commentary')).resolves.toEqual([]);
  });
});

describe('getConversation', () => {
  it('fetches and validates a real bilingual conversation from the backend', async () => {
    const sample = mockConversation.he;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual(sample);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/buyer-chat/conversation?language=he',
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('drops invalid messages returned by the API before exposing them', async () => {
    const validMessage = {
      speaker: 'buyer',
      id: 'incoming-1',
      sessionId: 'session-1',
      skipped: false,
      text: 'שלום',
    };
    const responseBody = [
      { speaker: 'banana', id: 'bad-1', sessionId: 'session-1', text: 'x' },
      validMessage,
      { speaker: 'system', id: 'bad-2', sessionId: 'session-1' },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 })));

    await expect(getConversation('he')).resolves.toEqual([validMessage]);
  });
});
