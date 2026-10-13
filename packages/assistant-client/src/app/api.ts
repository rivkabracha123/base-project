import { z } from 'zod';
import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  type AuctionLot,
  type UserProfile,
  userProfileSchema,
  houseRankingSchema,
  leadHandoffFromS1Draft,
  parseP3CurrentProfile,
  rankingItemFromS1Draft,
  s1DemoIntakeInput,
  confirmedItemDraftSchema,
  defaultRankingItem,
  sellerChoiceSchema,
  sellerContactFromP3Profile,
  sellerLeadSummarySchema,
  sellerLeadValuationSchema,
  sellerFinalLeadFixture,
  submitSellerLeadSchema,
  emitSellerEnquiryEvent,
  type HouseRanking,
  type P3CurrentProfile,
  type RankingItem,
  type ConfirmedItemDraft,
  type SellerChoice,
  type SellerLeadSummary,
  type SellerLeadValuation,
  type SubmitSellerLead,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import type { StaffLeadDetail, StaffLead, StaffLeadPipeline, UpdateStaffLeadPipelineInput } from '../staff-operations/staff-operations.types';
import { parseConversation, type BuyerMessage } from '../buyer/messages';
import { parseConversation as parseSellerConversation, type SellerMessage } from '../seller/messages';
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

// Week 5: delete the current anonymous session's profile.
export async function deleteCurrentProfile(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    method: 'DELETE',
    headers: profileHeaders(),
  });

  if (!response.ok) throw new Error(`Profile deletion failed with status ${response.status}`);
}

// Forget this browser's anonymous identifier after the profile was deleted,
// so the next visit starts clean instead of re-creating a profile under the old id.
export function resetAnonymousSession(): void {
  localStorage.removeItem(anonymousSessionStorageKey);
}

// Keep dashboard data limited to the fields required for manual review.
const staffLeadListSchema = z.array(z.object({
  id: z.string().min(1),
  type: z.enum(['buyer', 'seller']),
  clientName: z.string().min(1),
  status: z.string().min(1),
  category: z.string().min(1).optional(),
  requestDetails: z.string().min(1),
  createdAt: z.string().datetime(),
}));

const staffPipelineStatusSchema = z.enum(['new', 'reviewing', 'contacted', 'qualified', 'item_found', 'negotiating', 'won', 'lost', 'closed']);
const staffLeadPipelineSchema = z.object({
  status: staffPipelineStatusSchema,
  nextAction: z.string().min(1).nullable(),
  statusHistory: z.array(z.object({
    at: z.string().datetime(),
    from: staffPipelineStatusSchema.nullable(),
    to: staffPipelineStatusSchema,
  })),
  activityNotes: z.array(z.object({ at: z.string().datetime(), text: z.string().min(1) })),
});

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

function anonymousSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return getAnonymousSessionId();
  return 'session-synthetic-seller-1';
}

/** P3: GET /api/profiles/me. Returns null when the profile API is unavailable. */
export async function getCurrentP3Profile(
  signal?: AbortSignal,
): Promise<P3CurrentProfile | UserProfile | null> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    headers: { 'x-anonymous-session-id': anonymousSessionId() },
    signal,
  });
  if (!response.ok) return null;
  return parseP3CurrentProfile(await response.json());
}

/** P3: PATCH /api/profiles/me — grant service-contact consent for this browser session. */
export async function grantP3ServiceConsent(): Promise<P3CurrentProfile | UserProfile | null> {
  const response = await fetch(`${apiBaseUrl}/profiles/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-anonymous-session-id': anonymousSessionId(),
    },
    body: JSON.stringify({
      serviceConsent: {
        granted: true,
        grantedAt: new Date().toISOString(),
        channel: 'web',
      },
    }),
  });
  if (!response.ok) return null;
  return parseP3CurrentProfile(await response.json());
}

export { sellerContactFromP3Profile, rankingItemFromS1Draft, leadHandoffFromS1Draft };

/** Fallback ranking when S1 has not returned a confirmed item yet. */
export const sellerRankingItem: RankingItem = defaultRankingItem;

/** S1: POST /api/seller-intake/draft. Returns null when intake is unavailable. */
export async function getS1SellerDraft(
  signal?: AbortSignal,
  input: string = s1DemoIntakeInput,
): Promise<ConfirmedItemDraft | null> {
  const response = await fetch(`${apiBaseUrl}/seller-intake/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!response.ok) return null;
  const parsed = confirmedItemDraftSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
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

export async function getStaffOperationLeads(signal?: AbortSignal): Promise<StaffLead[]> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads`, { signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return staffLeadListSchema.parse(await response.json());
}

export async function getStaffLeadPipeline(leadId: string, signal?: AbortSignal): Promise<StaffLeadPipeline> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads/${encodeURIComponent(leadId)}/pipeline`, { signal });
  if (!response.ok) throw new StaffOperationLeadRequestError(response.status);
  return staffLeadPipelineSchema.parse(await response.json());
}

export async function updateStaffLeadPipeline(
  leadId: string,
  update: UpdateStaffLeadPipelineInput,
  signal?: AbortSignal,
): Promise<StaffLeadPipeline> {
  const response = await fetch(`${apiBaseUrl}/staff-operations/leads/${encodeURIComponent(leadId)}/pipeline`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
    signal,
  });
  if (!response.ok) throw new StaffOperationLeadRequestError(response.status);
  return staffLeadPipelineSchema.parse(await response.json());
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

/** Returns verified prior sales for one canonical itemKey. */
export async function getLotSaleHistory(itemKey: string, signal?: AbortSignal): Promise<AuctionLot[]> {
  if (import.meta.env.VITE_FIXTURE_MODE === 'true') return [];

  const response = await fetch(`${apiBaseUrl}/lots/history/${encodeURIComponent(itemKey)}`, { signal });
  if (!response.ok) throw new Error(`Sale history API request failed with status ${response.status}`);
  return z.array(auctionLotSchema).parse(await response.json());
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
export async function getAuctionLot(id: string, signal?: AbortSignal): Promise<AuctionLot | null> {
  const response = await fetch(`${apiBaseUrl}/lots/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) return null;
  const parsed = auctionLotSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

export { sellerFinalLeadFixture };

export function finalHandoffFromS1(
  draft: ConfirmedItemDraft | null,
  valuation?: SellerLeadValuation | null,
  comparables?: SubmitSellerLead['comparables'],
): SubmitSellerLead {
  const fallback = submitSellerLeadSchema.parse(sellerFinalLeadFixture.handoff);
  if (!draft) {
    return valuation
      ? submitSellerLeadSchema.parse({ ...fallback, valuation, ...(comparables ? { comparables } : {}) })
      : fallback;
  }
  try {
    const copied = leadHandoffFromS1Draft(draft, valuation ?? fallback.valuation);
    return submitSellerLeadSchema.parse({
      ...copied,
      ...(comparables?.length ? { comparables } : {}),
    });
  } catch {
    return fallback;
  }
}

export type SellerJourneyBundle = {
  ranking: HouseRanking;
  catalogDraft: { he: string; en: string };
  item: { id: string; category: string; title: string; evidenceIds: string[] };
  evidence: Array<{ id: string; type: string }>;
  valuation: SellerLeadValuation | null;
  comparables: NonNullable<SubmitSellerLead['comparables']>;
};

/** S1 confirmed draft in; S5 ranking plus live S3/S4 valuation out. */
export async function receiveS1SellerHandoff(
  draft: ConfirmedItemDraft,
  signal?: AbortSignal,
): Promise<SellerJourneyBundle | null> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/s1-handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
    signal,
  });
  if (!response.ok) return null;
  const body = (await response.json()) as SellerJourneyBundle;
  if (!body?.ranking || !body.catalogDraft) return null;
  const parsedValuation = body.valuation ? sellerLeadValuationSchema.safeParse(body.valuation) : null;
  return {
    ...body,
    valuation: parsedValuation?.success ? parsedValuation.data : null,
    comparables: body.comparables ?? [],
  };
}

/** S5 Week 2: create an internal draft lead. Contact/profile come from P3 when available. */
export async function createSellerLead(
  signal?: AbortSignal,
  contact?: { preferredName: string; email?: string; phone?: string },
  profile?: { profileId: string; serviceConsent: boolean },
): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/seller-leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anonymous-session-id': anonymousSessionId(),
    },
    body: JSON.stringify({
      ...draftEnquiryFixture.request,
      ...(profile ? { profileId: profile.profileId, serviceConsent: profile.serviceConsent } : {}),
      ...(contact ? { contact } : {}),
    }),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error('Draft enquiry did not return an id');
  return body.id;
}

/** S5 Week 3: rank houses for that lead and store the ranking on it. */
export async function rankHousesForLead(
  leadId: string,
  signal?: AbortSignal,
  item: RankingItem = sellerRankingItem,
): Promise<HouseRanking> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}/house-rankings`, {
    method: 'POST',
    headers: { ...profileHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const ranking = houseRankingSchema.parse(await response.json());
  emitSellerEnquiryEvent({ kind: 'house_ranking', ranking });
  return ranking;
}

/** S5: rank without creating a lead so the UI can show houses before contact. */
export async function rankHouses(
  signal?: AbortSignal,
  item: RankingItem = sellerRankingItem,
  emitEvent = true,
): Promise<HouseRanking> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/house-rankings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const ranking = houseRankingSchema.parse(await response.json());
  if (emitEvent) emitSellerEnquiryEvent({ kind: 'house_ranking', ranking });
  return ranking;
}

export async function saveSellerHouseChoice(
  leadId: string,
  houseId: string,
  signal?: AbortSignal,
): Promise<SellerChoice> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}/choice`, {
    method: 'POST',
    headers: { ...profileHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ houseId }),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const choice = sellerChoiceSchema.parse(await response.json());
  emitSellerEnquiryEvent({ kind: 'seller_choice', choice });
  return choice;
}

/** S5 Week 5: persist catalog draft and mark the internal lead submitted. Never contacts a house. */
export async function submitFinalSellerLead(
  leadId: string,
  handoff: SubmitSellerLead = submitSellerLeadSchema.parse(sellerFinalLeadFixture.handoff),
  signal?: AbortSignal,
): Promise<SellerLeadSummary> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/${encodeURIComponent(leadId)}/final`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(handoff),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const summary = sellerLeadSummarySchema.parse(await response.json());
  emitSellerEnquiryEvent({
    kind: 'internal_enquiry',
    houseName: summary.sellerChoice?.houseName ?? summary.recommendation?.recommendation?.house.name ?? 'Monabid',
  });
  return summary;
}

export type EvidenceReference = {
  fileId: string;
  profileId: string;
  itemId: string;
  originalName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  previewUri: string;
  downloadUri: string;
};

async function evidenceRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    throw new Error(body?.message ?? `Evidence request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

/** Fetch all evidence for a profile. The ordering endpoint requires the full profile list. */
export function getProfileEvidence(
  profileId: string,
  signal?: AbortSignal,
): Promise<EvidenceReference[]> {
  return evidenceRequest(
    `/evidence/${encodeURIComponent(profileId)}`,
    { signal },
  );
}

/** Fetch evidence for one item to display in its gallery. */
export function getItemEvidence(
  profileId: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<EvidenceReference[]> {
  return evidenceRequest(
    `/evidence/${encodeURIComponent(profileId)}/items/${encodeURIComponent(itemId)}`,
    { signal },
  );
}

export function uploadItemEvidence(
  profileId: string,
  itemId: string,
  files: File[],
): Promise<EvidenceReference[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file, file.name));

  return evidenceRequest(
    `/evidence/${encodeURIComponent(profileId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'POST', body: formData },
  );
}

export function deleteEvidence(
  profileId: string,
  fileId: string,
): Promise<{ success: boolean }> {
  return evidenceRequest(
    `/evidence/${encodeURIComponent(profileId)}/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' },
  );
}

export async function saveProfileEvidenceOrder(
  profileId: string,
  fileIds: string[],
): Promise<EvidenceReference[]> {
  const result = await evidenceRequest<{
    success: boolean;
    evidence: EvidenceReference[];
  }>(`/evidence/${encodeURIComponent(profileId)}/order`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  });

  return result.evidence;
}

/** Resolve an API-provided path against the backend URL. */
export function evidenceUrl(path: string): string {
  return new URL(path, apiBaseUrl).toString();
}

/** One persist call: rank once, save choice, submit. Used by the enquiry screen. */
export async function completeSellerEnquiry(
  input: {
    houseId: string;
    handoff: SubmitSellerLead;
    contact: { preferredName: string; email?: string; phone?: string };
    profileId?: string;
    preferredLanguage?: string;
    geography?: string;
  },
  signal?: AbortSignal,
): Promise<SellerLeadSummary> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/enquiry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anonymous-session-id': anonymousSessionId(),
    },
    body: JSON.stringify({
      houseId: input.houseId,
      ...input.handoff,
      contact: input.contact,
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.geography ? { geography: input.geography } : {}),
    }),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const summary = sellerLeadSummarySchema.parse(await response.json());
  emitSellerEnquiryEvent({
    kind: 'internal_enquiry',
    houseName: summary.sellerChoice?.houseName ?? summary.recommendation?.recommendation?.house.name ?? 'Monabid',
  });
  return summary;
}
