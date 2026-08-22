import { auctionLotSchema, type AuctionLot } from '@monabid/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export async function getSampleLot(language: string, signal?: AbortSignal): Promise<AuctionLot> {
  const response = await fetch(`${apiBaseUrl}/lots/sample?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return auctionLotSchema.parse(await response.json());
}
