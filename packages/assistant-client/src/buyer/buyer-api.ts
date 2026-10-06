export const buyerApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export async function fetchBuyerJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${buyerApiBaseUrl}${path}`, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}
