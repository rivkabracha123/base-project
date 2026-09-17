import { z } from 'zod';
import type { UserProfile } from './user-profile';

// This is the cross-team boundary contract for Buyer, Seller, and dashboard
// consumers (Week 4: "Connect the minimum fields needed by Buyer, Seller,
// and dashboard"). It deliberately excludes sessionId, profileId, language,
// marketingConsent, and every other profile field: P3 owns those, and no
// other feature is allowed to depend on them.
export const profileContactSnapshotSchema = z
  .object({
    preferredName: z.string().min(1).nullable(),
    email: z.string().email().nullable(),
    phone: z.string().min(1).nullable(),
    //only boolean
    serviceConsentGranted: z.boolean(),
  })
  // .strict() so a stray sessionId/profileId/language/marketingConsent field
  // added by mistake fails loudly instead of silently passing through.
  .strict()
  // Privacy invariant: without service consent, no contact detail may leave
  // this boundary, no matter what the underlying profile has stored.
  .refine((snapshot) => snapshot.serviceConsentGranted || (snapshot.email === null && snapshot.phone === null), {
    message: 'email and phone must be null when serviceConsentGranted is false',
  });

export type ProfileContactSnapshot = z.infer<typeof profileContactSnapshotSchema>;

// Converts UserProfile into the minimal snapshot.
// No side effects or I/O.

export function toProfileContactSnapshot(profile: UserProfile): ProfileContactSnapshot {
  const serviceConsentGranted = profile.serviceConsent.granted;

  return {
    // UserProfile uses `undefined` for "not provided yet"; the snapshot
    // contract normalizes that to `null` so every consumer handles one
    // consistent "empty" value instead of two.
    preferredName: profile.preferredName ?? null,
    // Without service consent, contact details never cross this boundary -
    // even if the profile itself still has them stored (e.g. consent was
    // withdrawn after being granted).
    email: serviceConsentGranted ? profile.email ?? null : null,
    phone: serviceConsentGranted ? profile.phone ?? null : null,
    serviceConsentGranted,
  };
}
