import { auctionLotFixtureSchema, auctionLotSchema, type AuctionLot } from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import { parseConversation, type BuyerMessage } from '../buyer/messages';

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

// Fetches a chat conversation and returns only messages that pass schema validation.
export async function getConversation(language: string, signal?: AbortSignal): Promise<BuyerMessage[]> {
  const response = await fetch(`${apiBaseUrl}/chat/conversation?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`Conversation API request failed with status ${response.status}`);
  return parseConversation(await response.json());
}
