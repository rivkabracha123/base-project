export const buyerApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export class BuyerApiError extends Error {
  constructor(readonly status: number) {
    super(`Buyer request failed (${status})`);
    this.name = 'BuyerApiError';
  }
}

export async function fetchBuyerJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${buyerApiBaseUrl}${path}`, init);
  if (!response.ok) {
    throw new BuyerApiError(response.status);
  }
  return (await response.json()) as T;
}
