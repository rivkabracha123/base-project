import { getCurrentProfile } from '../app/api';

const SESSION_STORAGE_KEY = 'monabid.seller.sessionId';

function getOrCreateId(storage: Storage, key: string): string {
  const existingId = storage.getItem(key);
  if (existingId) return existingId;

  const id = crypto.randomUUID();
  storage.setItem(key, id);
  return id;
}

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
