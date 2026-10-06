import {
  auctionLotFixtureSchema,
  auctionLotSchema,
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
  type AuctionLot,
  type HouseRanking,
  type P3CurrentProfile,
  type RankingItem,
  type UserProfile,
  type ConfirmedItemDraft,
  type SellerChoice,
  type SellerLeadSummary,
  type SellerLeadValuation,
  type SubmitSellerLead,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import draftEnquiryFixture from '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';
const ANONYMOUS_SESSION_KEY = 'monabid-anonymous-session-id';

function anonymousSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    const existing = globalThis.localStorage?.getItem(ANONYMOUS_SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    globalThis.localStorage?.setItem(ANONYMOUS_SESSION_KEY, created);
    return created;
  }
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
export async function getS1SellerDraft(signal?: AbortSignal): Promise<ConfirmedItemDraft | null> {
  const response = await fetch(`${apiBaseUrl}/seller-intake/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: s1DemoIntakeInput }),
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
    headers: { 'Content-Type': 'application/json' },
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
): Promise<HouseRanking> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/house-rankings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  const ranking = houseRankingSchema.parse(await response.json());
  emitSellerEnquiryEvent({ kind: 'house_ranking', ranking });
  return ranking;
}

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
