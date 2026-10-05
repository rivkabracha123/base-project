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
import type { StaffLeadDetail, StaffLead } from '../staff-operations/staff-operations.types';
import { parseConversation, type BuyerMessage } from '../buyer/messages';
import draftEnquiryFixture from '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const anonymousSessionStorageKey = 'anonymousSessionId';

export interface UpdateCurrentProfileInput {
  preferredName?: string;
  grammaticalForm?: 'masculine' | 'feminine' | 'neutral' | 'unspecified';
  email?: string;
  phone?: string;
  serviceConsent?: {
    granted: boolean;
    grantedAt?: string;
    channel?: string;
    policyVersion?: string;
  };
  marketingConsent?: {
    granted: boolean;
    grantedAt?: string;
    channel?: string;
    policyVersion?: string;
  };
}

export class StaffOperationLeadRequestError extends Error {
  constructor(readonly status: number) {
    super(`Staff operation lead request failed with status ${status}`);
  }
}

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

export async function updateCurrentProfile(
  update: UpdateCurrentProfileInput,
): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    method: 'PATCH',
    headers: {
      ...profileHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
  });

  if (!response.ok) throw new Error(`Profile update failed with status ${response.status}`);
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

const buyerLeadDetailSchema = z.object({
  id: z.string().min(1),
  type: z.literal('buyer'),
  status: z.string().min(1),
  criteria: z.record(z.unknown()),
  hardConstraints: z.array(z.object({
    field: z.string().min(1),
    operator: z.string().min(1),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.unknown()),
      z.record(z.unknown()),
    ]),
    reason: z.string().min(1),
  })),
  results: z.array(z.object({
    id: z.string().min(1),
    group: z.enum(['current', 'historical']),
  })),
  unmatchedDemand: z.object({
    reason: z.string().min(1),
    originalCriteria: z.record(z.unknown()),
  }).nullable(),
  contact: z.object({
    preferredName: z.string().min(1).nullable(),
    email: z.string().email().nullable(),
    phone: z.string().min(1).nullable(),
    followUpStatus: z.enum(['ready', 'consent_required', 'contact_missing']),
    serviceConsent: z.object({
      granted: z.boolean(),
      grantedAt: z.string().datetime().optional(),
      channel: z.string().min(1).optional(),
      policyVersion: z.string().min(1).optional(),
    }),
  }),
});

const legacySellerLeadDetailSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('seller'),
  status: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  item: z.record(z.unknown()),
  evidence: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) })),
  comparables: z.array(z.object({
    id: z.string().min(1),
    source: z.object({ label: z.string().min(1), url: z.string().url().nullable() }).optional(),
  })),
  valuation: z.object({
    status: z.enum(['supported', 'refusal']),
    reportId: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    valuationRange: z.object({ min: z.number(), max: z.number(), currency: z.literal('USD') }).optional(),
    confidence: z.object({ level: z.literal('low'), explanation: z.string().min(1) }).optional(),
    limitations: z.array(z.string().min(1)).optional(),
    comparableCount: z.number().int().nonnegative().optional(),
    comparables: z.array(z.object({
      id: z.string().min(1),
      source: z.object({ label: z.string().min(1), url: z.string().url().nullable() }).optional(),
    })).optional(),
    excludedComparables: z.array(z.object({ id: z.string().min(1), reason: z.string().min(1) })).optional(),
  }).nullable(),
  recommendation: z.record(z.unknown()).nullable(),
  alternatives: z.array(z.record(z.unknown())),
  sellerChoice: z.record(z.unknown()).nullable(),
  catalogDraft: z.record(z.unknown()).nullable(),
  contact: z.object({
    preferredName: z.string().min(1).nullable(),
    email: z.string().email().nullable(),
    phone: z.string().min(1).nullable(),
    serviceConsentGranted: z.boolean(),
  }).refine((contact) => contact.serviceConsentGranted || (contact.email === null && contact.phone === null), {
    message: 'Contact details require service consent',
  }),
  history: z.array(z.object({
    at: z.string().datetime(),
    event: z.enum(['drafted', 'ranked', 'chose_house', 'submitted']),
    actor: z.enum(['system', 'seller']),
  })),
});

const sellerLeadDashboardDetailSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(['draft', 'submitted']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  item: z.object({
    id: z.string().min(1),
    category: z.string().min(1),
    title: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)),
  }).nullable(),
  evidence: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) })),
  comparables: z.array(z.object({ id: z.string().min(1), source: z.string().min(1).optional() })),
  valuation: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('supported'),
      reportId: z.string().min(1),
      comparableCount: z.number().int().nonnegative(),
      confidence: z.object({ level: z.literal('low'), explanation: z.string().min(1) }),
      limitations: z.array(z.string().min(1)).min(1),
      comparables: z.array(z.object({
        id: z.string().min(1),
        source: z.object({ label: z.string().min(1), url: z.string().url().nullable() }),
        saleDate: z.string().date().optional(),
      })),
      excludedComparables: z.array(z.object({ id: z.string().min(1), reason: z.string().min(1) })),
      valuationRange: z.object({ min: z.number(), max: z.number(), currency: z.literal('USD') }),
    }),
    z.object({
      status: z.literal('refusal'),
      reportId: z.string().min(1),
      comparableCount: z.number().int().nonnegative(),
      confidence: z.object({ level: z.literal('low'), explanation: z.string().min(1) }),
      limitations: z.array(z.string().min(1)).min(1),
      comparables: z.array(z.object({
        id: z.string().min(1),
        source: z.object({ label: z.string().min(1), url: z.string().url().nullable() }),
        saleDate: z.string().date().optional(),
      })),
      excludedComparables: z.array(z.object({ id: z.string().min(1), reason: z.string().min(1) })),
      reason: z.string().min(1),
    }),
  ]).nullable(),
  recommendation: z.record(z.unknown()).nullable(),
  alternatives: z.array(z.record(z.unknown())),
  sellerChoice: z.record(z.unknown()).nullable(),
  catalogDraft: z.record(z.unknown()).nullable(),
  contact: z.object({
    preferredName: z.string().min(1).nullable(),
    email: z.string().email().nullable(),
    phone: z.string().min(1).nullable(),
    serviceConsentGranted: z.boolean(),
  }).refine((contact) => contact.serviceConsentGranted || (contact.email === null && contact.phone === null), {
    message: 'Contact details require service consent',
  }),
  history: z.array(z.object({
    at: z.string().datetime(),
    event: z.enum(['drafted', 'ranked', 'chose_house', 'submitted']),
    actor: z.enum(['system', 'seller']),
  })),
}).transform(({ leadId, comparables, ...detail }) => ({
  ...detail,
  id: leadId,
  type: 'seller' as const,
  comparables: comparables.map(({ id, source }) => ({
    id,
    source: source ? { label: source, url: null } : undefined,
  })),
}));

const sellerLeadDetailSchema = z.union([legacySellerLeadDetailSchema, sellerLeadDashboardDetailSchema]);

const staffLeadDetailSchema = z.union([buyerLeadDetailSchema, sellerLeadDetailSchema]);

// Fetches a sample lot either from fixtures or the backend API.
// Keeps the UI deterministic in fixture mode and contract-safe in real mode.
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

export async function getStaffOperationLeadDetail(
  leadId: string,
  leadType: StaffLead['type'] = 'buyer',
  signal?: AbortSignal,
): Promise<StaffLeadDetail> {
  const endpoint = leadType === 'seller'
    ? `${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}`
    : `${apiBaseUrl}/staff-operations/leads/${encodeURIComponent(leadId)}`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new StaffOperationLeadRequestError(response.status);
  return leadType === 'seller'
    ? sellerLeadDetailSchema.parse(await response.json())
    : buyerLeadDetailSchema.parse(await response.json());
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

export async function getConversation(language: string, signal?: AbortSignal): Promise<BuyerMessage[]> {
  const response = await fetch(`${apiBaseUrl}/chat/conversation?language=${encodeURIComponent(language)}`, { signal });
  if (!response.ok) throw new Error(`Conversation API request failed with status ${response.status}`);
  return parseConversation(await response.json());
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
