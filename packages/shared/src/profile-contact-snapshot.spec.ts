import { describe, expect, it } from 'vitest';
import { toProfileContactSnapshot, profileContactSnapshotSchema } from './profile-contact-snapshot';
import type { UserProfile } from './user-profile';

/**
 * Unit tests for the pure mapping function that produces the minimum
 * profile contract. No database, no HTTP - just object in, object out.
 */

// A fully filled-in profile, used as the baseline for every test below.
const fullProfile: UserProfile = {
  id: 'profile-1',
  sessionId: 'sess-1',
  language: 'he',
  grammaticalForm: 'feminine',
  preferredName: 'רחל',
  email: 'rachel@example.com',
  phone: '+972-50-0000000',
  serviceConsent: {
    granted: true,
    grantedAt: '2026-08-30T10:30:00.000Z',
    channel: 'web',
    policyVersion: 'v1.0',
  },
  marketingConsent: { granted: false },
  createdAt: '2026-08-30T10:25:00.000Z',
  updatedAt: '2026-08-30T10:30:00.000Z',
};

describe('toProfileContactSnapshot', () => {
  it('keeps only the fields Buyer/Seller/Dashboard are allowed to depend on', () => {
    expect(toProfileContactSnapshot(fullProfile)).toEqual({
      preferredName: 'רחל',
      email: 'rachel@example.com',
      phone: '+972-50-0000000',
      serviceConsentGranted: true,
    });
  });

  it('does not leak sessionId, language, consent metadata, or marketingConsent into the snapshot', () => {
    const snapshot = toProfileContactSnapshot(fullProfile);

    expect(snapshot).not.toHaveProperty('sessionId');
    expect(snapshot).not.toHaveProperty('language');
    expect(snapshot).not.toHaveProperty('grantedAt');
    expect(snapshot).not.toHaveProperty('channel');
    expect(snapshot).not.toHaveProperty('policyVersion');
    expect(snapshot).not.toHaveProperty('marketingConsent');
  });

  it('nulls out email and phone when service consent is false, even if the profile still has them stored', () => {
    // e.g. the visitor filled in contact details and then withdrew consent.
    const consentWithdrawnProfile: UserProfile = {
      ...fullProfile,
      serviceConsent: { granted: false },
    };

    const snapshot = toProfileContactSnapshot(consentWithdrawnProfile);

    expect(snapshot.email).toBeNull();
    expect(snapshot.phone).toBeNull();
    expect(() => profileContactSnapshotSchema.parse(snapshot)).not.toThrow();
  });

  it('rejects a hand-built snapshot that exposes contact details without consent', () => {
    expect(() =>
      profileContactSnapshotSchema.parse({
        preferredName: 'רחל',
        email: 'rachel@example.com',
        phone: null,
        serviceConsentGranted: false,
      }),
    ).toThrow();
  });

  it('turns missing optional contact fields into null, not undefined', () => {
    const anonymousProfile: UserProfile = {
      ...fullProfile,
      preferredName: undefined,
      email: undefined,
      phone: undefined,
      serviceConsent: { granted: false },
    };

    const snapshot = toProfileContactSnapshot(anonymousProfile);

    expect(snapshot.preferredName).toBeNull();
    expect(snapshot.email).toBeNull();
    expect(snapshot.phone).toBeNull();
    expect(snapshot.serviceConsentGranted).toBe(false);
  });

  it('rejects a snapshot carrying sessionId, profileId, or language - even if someone adds them by mistake', () => {
    expect(() =>
      profileContactSnapshotSchema.parse({
        sessionId: 'sess-1',
        language: 'he',
        preferredName: null,
        email: null,
        phone: null,
        serviceConsentGranted: false,
      }),
    ).toThrow();

    expect(() =>
      profileContactSnapshotSchema.parse({
        profileId: 'profile-1',
        preferredName: null,
        email: null,
        phone: null,
        serviceConsentGranted: false,
      }),
    ).toThrow();
  });

  it('rejects a snapshot with an invalid email', () => {
    expect(() =>
      profileContactSnapshotSchema.parse({
        preferredName: 'Dana',
        email: 'not-an-email',
        phone: null,
        serviceConsentGranted: true,
      }),
    ).toThrow();
  });
});
