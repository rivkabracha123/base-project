import { z } from 'zod';
import { toProfileContactSnapshot } from './profile-contact-snapshot';
import { userProfileSchema, type UserProfile } from './user-profile';

/**
 * P3 current-profile contract consumed by S5 (GET /api/profiles/me).
 * Prefers Avishag's UserProfile; never copies marketingConsent.
 */
const optionalText = z.string().optional().nullable();

const serviceConsentRecord = z
  .object({
    granted: z.boolean().optional(),
    serviceConsentGranted: z.boolean().optional(),
  })
  .passthrough();

const serviceConsentValue = z.union([z.boolean(), serviceConsentRecord]);

export const p3CurrentProfileSchema = z
  .object({
    id: z.string().min(1),
    preferredName: optionalText,
    preferred_name: optionalText,
    email: optionalText,
    phone: optionalText,
    serviceConsent: serviceConsentValue.optional(),
    service_consent: serviceConsentValue.optional(),
    serviceConsentGranted: z.boolean().optional(),
    contact: z
      .object({
        preferredName: optionalText,
        preferred_name: optionalText,
        email: optionalText,
        phone: optionalText,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type P3CurrentProfile = z.infer<typeof p3CurrentProfileSchema>;

export function parseP3CurrentProfile(payload: unknown): P3CurrentProfile | UserProfile {
  const official = userProfileSchema.safeParse(payload);
  if (official.success) return official.data;
  return p3CurrentProfileSchema.parse(payload);
}

function text(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';
}

function serviceConsentGranted(profile: P3CurrentProfile): boolean {
  const raw = profile.serviceConsent ?? profile.service_consent ?? profile.serviceConsentGranted;
  if (raw === true) return true;
  if (raw && typeof raw === 'object') {
    return raw.granted === true || raw.serviceConsentGranted === true;
  }
  return false;
}

export function sellerContactFromP3Profile(profile: P3CurrentProfile | UserProfile): {
  profileId: string;
  preferredName: string;
  email?: string;
  phone?: string;
  serviceConsent: boolean;
} {
  const official = userProfileSchema.safeParse(profile);
  if (official.success) {
    const snapshot = toProfileContactSnapshot(official.data);
    return {
      profileId: official.data.id,
      preferredName: snapshot.preferredName?.trim() ?? '',
      ...(snapshot.email ? { email: snapshot.email } : {}),
      ...(snapshot.phone ? { phone: snapshot.phone } : {}),
      serviceConsent: snapshot.serviceConsentGranted,
    };
  }

  const loose = p3CurrentProfileSchema.parse(profile);
  const preferredName = text(
    loose.preferredName,
    loose.preferred_name,
    loose.contact?.preferredName,
    loose.contact?.preferred_name,
  );
  const email = text(loose.email, loose.contact?.email);
  const phone = text(loose.phone, loose.contact?.phone);
  return {
    profileId: loose.id,
    preferredName,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    serviceConsent: serviceConsentGranted(loose),
  };
}
