import { getCurrentProfile } from '../app/api';

const SESSION_STORAGE_KEY = 'monabid.seller.sessionId';

// מחזירה מזהה קיים מהאחסון או יוצרת ושומרת מזהה חדש.
// Returns an existing stored identifier or creates and stores a new one.
function getOrCreateId(storage: Storage, key: string): string {
  const existingId = storage.getItem(key);
  if (existingId) return existingId;

  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

// המזהים ש-B1 מוסרת ל-S1: הפרופיל האנונימי מ-P3 (מהשרת) ומזהה השיחה של הדפדפן הזה.
// הפרופיל מגיע מ-P3 ולא נוצר בצ'אט, כדי שהטיוטה, התמונות והגלריה יעבדו כולם מול אותו פרופיל.
// The identifiers B1 hands to S1: the anonymous profile from P3 (the server) and this browser's session.
// The profile comes from P3 instead of being created in the chat, so the draft, the photos and the gallery all use the same profile.
export async function getSellerMessageIds(): Promise<{ profileId: string; sessionId: string }> {
  if (typeof sessionStorage === 'undefined') {
    throw new Error('Seller chat requires browser storage');
  }

  const profile = await getCurrentProfile();
  return {
    profileId: profile.id,
    sessionId: getOrCreateId(sessionStorage, SESSION_STORAGE_KEY),
  };
}
