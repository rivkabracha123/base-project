import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  type AuctionLot,
  type UserProfile,
  userProfileSchema,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const anonymousSessionStorageKey = 'anonymousSessionId';

export function getAnonymousSessionId(): string {
  // Reuse the identifier saved for this browser on earlier visits.
  const savedSessionId = localStorage.getItem(anonymousSessionStorageKey);
  if (savedSessionId) return savedSessionId;

  // Generate and persist an identifier only for a first-time anonymous visitor.
  const newSessionId = crypto.randomUUID();
  localStorage.setItem(anonymousSessionStorageKey, newSessionId);
  return newSessionId;
}

function profileHeaders(): HeadersInit {
  // The backend uses this identifier to find only this browser's profile.
  return { 'x-anonymous-session-id': getAnonymousSessionId() };
}

export async function getCurrentProfile(signal?: AbortSignal): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    headers: profileHeaders(),
    signal,
  });

  if (!response.ok) throw new Error(`Profile request failed with status ${response.status}`);
  return userProfileSchema.parse(await response.json());
}

export async function updateProfileLanguage(language: 'he' | 'en'): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/profiles/me/language`, {
    method: 'PATCH',
    headers: {
      ...profileHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ language }),
  });

  if (!response.ok) throw new Error(`Language update failed with status ${response.status}`);
  return userProfileSchema.parse(await response.json());
}

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
