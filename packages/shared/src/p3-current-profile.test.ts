import { describe, expect, it } from 'vitest';
import { p3CurrentProfileSchema, sellerContactFromP3Profile } from './p3-current-profile';
import type { UserProfile } from './user-profile';

describe('P3 current profile contract for S5', () => {
  it('reads preferredName, email, and service consent from GET /api/profiles/me', () => {
    const profile = p3CurrentProfileSchema.parse({
      id: 'profile-p3-1',
      preferredName: 'Avishag Profile',
      email: 'p3.seller@example.test',
      serviceConsent: true,
    });

    expect(sellerContactFromP3Profile(profile)).toEqual({
      profileId: 'profile-p3-1',
      preferredName: 'Avishag Profile',
      email: 'p3.seller@example.test',
      serviceConsent: true,
    });
  });

  it('reads Avishag user_profiles column names and jsonb service_consent', () => {
    const profile = p3CurrentProfileSchema.parse({
      id: 'profile-p3-2',
      preferred_name: 'Maya',
      email: 'maya@example.test',
      phone: null,
      service_consent: { granted: true, version: 1 },
      marketing_consent: { granted: false },
    });

    const contact = sellerContactFromP3Profile(profile);
    expect(contact).toEqual({
      profileId: 'profile-p3-2',
      preferredName: 'Maya',
      email: 'maya@example.test',
      serviceConsent: true,
    });
    expect(JSON.stringify(contact)).not.toMatch(/marketing/i);
  });

  it('copies contact from Avishag UserProfile and drops marketingConsent', () => {
    const profile: UserProfile = {
      id: 'profile-p3-3',
      sessionId: 'sess-1',
      language: 'he',
      preferredName: 'Avishag',
      email: 'avishag@example.test',
      phone: null,
      serviceConsent: { granted: true, grantedAt: '2026-09-01T00:00:00.000Z' },
      marketingConsent: { granted: true },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const contact = sellerContactFromP3Profile(profile);
    expect(contact).toEqual({
      profileId: 'profile-p3-3',
      preferredName: 'Avishag',
      email: 'avishag@example.test',
      serviceConsent: true,
    });
    expect(JSON.stringify(contact)).not.toMatch(/marketing/i);
  });

  it('hides email and phone when P3 service consent is not granted', () => {
    const profile: UserProfile = {
      id: 'profile-p3-4',
      sessionId: 'sess-2',
      language: 'en',
      preferredName: 'Maya',
      email: 'maya@example.test',
      phone: '+972500000000',
      serviceConsent: { granted: false },
      marketingConsent: { granted: false },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    expect(sellerContactFromP3Profile(profile)).toEqual({
      profileId: 'profile-p3-4',
      preferredName: 'Maya',
      serviceConsent: false,
    });
  });
});
