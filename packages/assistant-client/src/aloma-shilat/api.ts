export type DemoLot = {
  id: string;
  title: string;
  description: string;
  category: string;
  saleDate: string;
  status: 'upcoming' | 'sold' | 'unsold';
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export async function fetchDemoLot(signal?: AbortSignal): Promise<DemoLot> {
  const response = await fetch(`${apiBaseUrl}/aluma-shilat/demo`, { signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as DemoLot;
}
