import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  houseRankingSchema,
  sellerChoiceSchema,
  type AuctionLot,
  type HouseRanking,
  type RankingItem,
  type SellerChoice,
} from '@monabid/shared';
import lotFixtures from '../../../../fixtures/auction-data/lots.json';
import draftEnquiryFixture from '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

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
