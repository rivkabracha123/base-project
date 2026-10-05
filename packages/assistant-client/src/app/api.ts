import { z } from 'zod';
import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  type AuctionLot,
  type UserProfile,
  userProfileSchema,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import type { StaffBuyerLeadDetail, StaffLead } from '../staff-operations.types';

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

// Week 5: delete the current anonymous session's profile.
export async function deleteCurrentProfile(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    method: 'DELETE',
    headers: profileHeaders(),
  });

  if (!response.ok) throw new Error(`Profile deletion failed with status ${response.status}`);
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

// Fetches a sample lot either from fixtures or the backend API.
// Keeps the UI deterministic in fixture mode and contract-safe in real mode.
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
  signal?: AbortSignal,
): Promise<StaffBuyerLeadDetail> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads/${encodeURIComponent(leadId)}`, { signal });
  if (!response.ok) throw new StaffOperationLeadRequestError(response.status);
  return buyerLeadDetailSchema.parse(await response.json());
}
