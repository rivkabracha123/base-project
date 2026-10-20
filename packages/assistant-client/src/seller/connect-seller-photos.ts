import type { OnChatUpdate } from '../chat/chat-types';
import { sellerImagesSchema, type SellerMessage } from './messages';
import { getSellerMessageIds } from './seller-ids';
import { sellerPhotosStepText } from './seller-steps';
import i18n, { getBrowserLanguage } from '../i18n';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

// החיבור של תמונות המוכר ל-S1 — המקבילה של connectSellerLevels להודעות טקסט.
// The seller-photo hand-off to S1 — the counterpart of connectSellerLevels for text messages.
//
// הצ'אט (B1) מוסר ל-S1 את כל הקבצים יחד עם הפרופיל מ-P3; S1 מעבירה אותם ל-S2 לשמירה ומצרפת
// את ההפניות לטיוטה. כללי הקבצים (סוג, גודל, עד 10) נבדקים ב-S2.
// The chat (B1) hands S1 all the files together with the P3 profile; S1 passes them to S2 for storage
// and attaches the references to the draft. The file rules (type, size, up to 10) are checked by S2.
//
// כל קריאה היא העלאה אחת = פריט אחד.
// One call is one upload = one item.
export async function connectSellerPhotos(
  files: File[],
  onUpdate: OnChatUpdate<SellerMessage>,
): Promise<void> {
  if (files.length === 0) throw new Error('No photos to upload');

  onUpdate({ speaker: 'system', text: sellerPhotosStepText(getBrowserLanguage(i18n.language)) });
  const { profileId, sessionId } = await getSellerMessageIds();
  const body = new FormData();
  files.forEach((file) => body.append('files', file, file.name));

  const response = await fetch(
    `${API_BASE_URL}/seller-intake/draft/${encodeURIComponent(profileId)}/${encodeURIComponent(sessionId)}/photos`,
    { method: 'POST', body },
  );
  if (!response.ok) throw new Error(`Seller photo upload failed (${response.status})`);

  const images = sellerImagesSchema.parse(await response.json());

  onUpdate({ speaker: 'seller', images });
}
