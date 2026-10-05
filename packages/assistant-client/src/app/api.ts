import {
  auctionLotFixtureSchema,
  auctionLotSchema,
  houseRankingSchema,
  sellerChoiceSchema,
  sellerLeadSummarySchema,
  sellerFinalLeadFixture,
  submitSellerLeadSchema,
  type AuctionLot,
  type HouseRanking,
  type RankingItem,
  type SellerChoice,
  type SellerLeadSummary,
  type SubmitSellerLead,
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

export { sellerFinalLeadFixture };

/** S5 Week 2: create an internal draft lead. Uses P3-shaped contact (fixture or seller-entered). */
export async function createSellerLead(
  signal?: AbortSignal,
  contact?: { preferredName: string; email?: string; phone?: string },
): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/seller-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draftEnquiryFixture.request,
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

/** S5: rank without creating a lead so the UI can show houses before contact. */
export async function rankHouses(signal?: AbortSignal): Promise<HouseRanking> {
  const response = await fetch(`${apiBaseUrl}/seller-leads/house-rankings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sellerRankingItem),
    signal,
  });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return houseRankingSchema.parse(await response.json());
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
  return sellerChoiceSchema.parse(await response.json());
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
  return sellerLeadSummarySchema.parse(await response.json());
}
