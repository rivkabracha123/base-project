import { z } from 'zod';
import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  type AuctionLot,
  type UserProfile,
  userProfileSchema,
  houseRankingSchema,
  sellerChoiceSchema,
  type HouseRanking,
  type RankingItem,
  type SellerChoice,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import type { StaffLead } from '../staff-operations.types';
import draftEnquiryFixture from '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json';

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

// Keep dashboard data limited to the fields required for manual review.
const staffLeadListSchema = z.array(z.object({
  id: z.string().min(1),
  type: z.enum(['buyer', 'seller']),
  clientName: z.string().min(1),
  status: z.string().min(1),
  requestDetails: z.string().min(1),
  createdAt: z.string().datetime(),
}));

/** S5 ranking input until S1 publishes confirmed items. */
export const sellerRankingItem: RankingItem = {
  category: 'rare_books',
  geography: 'United States',
  preferredLanguage: 'en',
};

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

export async function getStaffOperationLeads(signal?: AbortSignal): Promise<StaffLead[]> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return staffLeadListSchema.parse(await response.json());
}

/** S5 Week 2: create an internal draft lead. Uses the prepared P3-shaped contact fixture. */
export async function createSellerLead(signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/seller-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draftEnquiryFixture.request),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error('Draft enquiry did not return an id');
  return body.id;
}

/** S5 Week 3: rank houses for that lead and store the ranking on it. */
export async function rankHousesForLead(leadId: string, signal?: AbortSignal): Promise<HouseRanking> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}/house-rankings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sellerRankingItem),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return houseRankingSchema.parse(await response.json());
}

/**
 * S5 Week 4: save the seller’s house pick.
 * Parses the response with sellerChoiceSchema so a bad API shape cannot reach the UI.
 */
export async function saveSellerHouseChoice(
  leadId: string,
  houseId: string,
  signal?: AbortSignal,
): Promise<SellerChoice> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}/choice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ houseId }),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return sellerChoiceSchema.parse(await response.json());
}
