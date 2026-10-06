import { auctionLotFixtureSchema, auctionLotSchema, type AuctionLot } from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import { parseConversation, type BuyerMessage } from '../buyer/messages';
import { parseConversation as parseSellerConversation, type SellerMessage } from '../seller/messages';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export async function getSampleLot(language: string, signal?: AbortSignal): Promise<AuctionLot> {
  if (import.meta.env.VITE_FIXTURE_MODE === 'true') {
    const [sampleLot] = auctionLotFixtureSchema.parse(lotFixtures);
    if (!sampleLot) throw new Error('No sample fixture is available');
    return sampleLot;
  }

  const response = await fetch(`${apiBaseUrl}/lots/sample?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return auctionLotSchema.parse(await response.json());
}

export async function getLotById(id: string, language: string, signal?: AbortSignal): Promise<AuctionLot> {
  if (import.meta.env.VITE_FIXTURE_MODE === 'true') {
    const lot = auctionLotFixtureSchema.parse(lotFixtures).find((fixture) => fixture.id === id);
    if (!lot) throw new Error('API request failed with status 404');
    return lot;
  }

  const response = await fetch(`${apiBaseUrl}/lots/${encodeURIComponent(id)}?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return auctionLotSchema.parse(await response.json());
}

// Fetches a conversation from the given path and returns only messages that pass the role's schema validation.
async function fetchConversation<TMessage>(
  path: string,
  parse: (input: unknown) => TMessage[],
  language: string,
  signal?: AbortSignal,
): Promise<TMessage[]> {
  const response = await fetch(`${apiBaseUrl}/${path}?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`Conversation API request failed with status ${response.status}`);
  return parse(await response.json());
}

// Fetches a buyer chat conversation.
export function getConversation(language: string, signal?: AbortSignal): Promise<BuyerMessage[]> {
  return fetchConversation('buyer-chat/conversation', parseConversation, language, signal);
}

// Fetches a seller chat conversation.
export function getSellerConversation(language: string, signal?: AbortSignal): Promise<SellerMessage[]> {
  return fetchConversation('seller-chat/conversation', parseSellerConversation, language, signal);
}
