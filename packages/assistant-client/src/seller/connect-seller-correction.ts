import { sellerItemDraftSchema, type SellerItemDraft } from '@monabid/shared';
import { getSellerMessageIds } from './seller-ids';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export type SellerDraftCorrectionField =
  | 'title'
  | 'category'
  | 'description'
  | 'materials'
  | 'dimensions'
  | 'condition'
  | 'marks'
  | 'signatures'
  | 'provenance';

export type SellerDraftCorrectionValue =
  | string
  | string[]
  | { he?: string; en?: string }
  | { values: Array<{ label: string; value: number; unit: string }> }
  | { label: string; value: number; unit: string }[];

function parseDraftResponse(value: unknown): SellerItemDraft {
  if (!value || typeof value !== 'object' || !('draft' in value)) {
    throw new Error('Seller draft response did not include a draft');
  }
  const parsed = sellerItemDraftSchema.safeParse(value.draft);
  if (!parsed.success) throw new Error('Seller draft response was invalid');
  return parsed.data;
}

export async function getCurrentSellerDraft(): Promise<SellerItemDraft | null> {
  const { profileId, sessionId } = await getSellerMessageIds();
  const response = await fetch(
    `${API_BASE_URL}/seller-intake/draft/${encodeURIComponent(profileId)}/${encodeURIComponent(sessionId)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Seller draft request failed (${response.status})`);
  return parseDraftResponse(await response.json());
}

export async function removeSellerPhoto(fileId: string): Promise<SellerItemDraft> {
  const { profileId, sessionId } = await getSellerMessageIds();
  const response = await fetch(`${API_BASE_URL}/seller-intake/draft/${encodeURIComponent(profileId)}/${encodeURIComponent(sessionId)}/photos/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Could not remove the photo');
  return parseDraftResponse(await response.json());
}

export async function correctSellerDraftField(
  field: SellerDraftCorrectionField,
  value: SellerDraftCorrectionValue,
): Promise<SellerItemDraft> {
  const { profileId, sessionId } = await getSellerMessageIds();
  const response = await fetch(
    `${API_BASE_URL}/seller-intake/draft/${encodeURIComponent(profileId)}/${encodeURIComponent(sessionId)}/corrections`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    },
  );
  if (!response.ok) throw new Error(`Seller correction request failed (${response.status})`);
  return parseDraftResponse(await response.json());
}
