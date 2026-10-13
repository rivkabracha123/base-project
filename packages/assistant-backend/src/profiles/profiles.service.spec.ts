import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';
import type { LocalFileStorage } from '../storage/local-file-storage.service';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  // Keep the fake repository as Jest functions so test setup can use
  // mockResolvedValue, mockReturnValue, and mockImplementation.
  let repository: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let storage: { deleteProfile: jest.Mock };
  let service: ProfilesService;

  const createFakeProfile = (
    id: string,
    sessionId: string,
    language: 'he' | 'en',
    overrides: Partial<Pick<UserProfileEntity,
      | 'grammaticalForm'
      | 'preferredName'
      | 'email'
      | 'phone'
      | 'serviceConsent'
      | 'marketingConsent'
    >> = {},
  ): UserProfileEntity => {
    return Object.assign(new UserProfileEntity(), {
      id,
      sessionId,
      language,
      grammaticalForm: undefined,
      preferredName: undefined,
      email: undefined,
      phone: undefined,
      serviceConsent: { granted: false },
      marketingConsent: { granted: false },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });
  };

  beforeEach(() => {
    // Create a fresh fake repository before every test.
    // It replaces the real database, so no real profile data is changed.
    repository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    storage = {
      deleteProfile: jest.fn().mockResolvedValue(undefined),
    };

    // The service does not exist yet. This line is intentional in TDD:
    // the test should fail until the service is implemented.
    service = new ProfilesService(
      repository as unknown as Repository<UserProfileEntity>,
      storage as unknown as LocalFileStorage,
    );
  });

  // Ownership: the lookup must use BOTH profile id and session id; no match means 404.
  it('returns an owned profile and throws NotFound for a profile of another session', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValueOnce(profile);
    await expect(service.getOwnedProfileEntity('session-1', 'profile-1')).resolves.toBe(profile);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'profile-1', sessionId: 'session-1' });

    repository.findOneBy.mockResolvedValueOnce(null);
    await expect(service.getOwnedProfileEntity('session-2', 'profile-1')).rejects.toThrow(NotFoundException);
  });

  // Test 1: A new anonymous browser session receives a new profile.
  it('creates an anonymous profile for a new session', async () => {
    // The fake database has no profile for this browser session.
    repository.findOneBy.mockResolvedValue(null);

    const newProfile = createFakeProfile('profile-1', 'new-session', 'he');
    repository.create.mockReturnValue(newProfile);
    repository.save.mockResolvedValue(newProfile);

    // Ask the service for the profile owned by this anonymous session.
    const result = await service.getOrCreateBySessionId('new-session');

    // A new profile must belong to the session that requested it.
    expect(result.sessionId).toBe('new-session');
    expect(repository.create).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(newProfile);
  });

  it('propagates a profile creation failure instead of returning success', async () => {
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockReturnValue(
      createFakeProfile('profile-1', 'fixture-session', 'he'),
    );
    repository.save.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.getOrCreateBySessionId('fixture-session'),
    ).rejects.toThrow('database unavailable');
  });

  it('propagates a profile update failure', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.updateCurrentProfile('session-1', { preferredName: 'Dana' }),
    ).rejects.toThrow('database unavailable');
  });

  // Test 2: Every new anonymous profile starts with Hebrew as its language.
  it('uses Hebrew as the default language for a new profile', async () => {
    repository.findOneBy.mockResolvedValue(null);

    const newProfile = createFakeProfile('profile-1', 'new-session', 'he');
    repository.create.mockReturnValue(newProfile);
    repository.save.mockResolvedValue(newProfile);

    const result = await service.getOrCreateBySessionId('new-session');

    // The team decision is that a new anonymous profile starts in Hebrew.
    expect(result.language).toBe('he');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'new-session', language: 'he' }),
    );
  });

  // Test 3: The same anonymous browser session receives its original profile.
  it('returns the existing profile for the same session', async () => {
    const existingProfile = createFakeProfile(
      'profile-existing',
      'known-session',
      'he',
    );
    repository.findOneBy.mockResolvedValue(existingProfile);

    const result = await service.getOrCreateBySessionId('known-session');

    // The session receives its existing profile instead of a duplicate.
    expect(result.id).toBe('profile-existing');
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns a privacy-safe contact snapshot without service consent', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      preferredName: 'Synthetic Buyer',
      email: 'buyer@example.test',
      phone: '+972500000000',
      serviceConsent: { granted: false },
      marketingConsent: { granted: true },
    });
    repository.findOneBy.mockResolvedValue(profile);

    await expect(
      service.getContactSnapshotBySessionId('session-1'),
    ).resolves.toEqual({
      preferredName: 'Synthetic Buyer',
      email: null,
      phone: null,
      serviceConsentGranted: false,
    });
  });

  it('returns contact details only when service consent is granted', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      preferredName: 'Synthetic Buyer',
      email: 'buyer@example.test',
      serviceConsent: { granted: true },
      marketingConsent: { granted: false },
    });
    repository.findOneBy.mockResolvedValue(profile);

    const snapshot = await service.getContactSnapshotBySessionId('session-1');

    expect(snapshot).toEqual({
      preferredName: 'Synthetic Buyer',
      email: 'buyer@example.test',
      phone: null,
      serviceConsentGranted: true,
    });
    expect(snapshot).not.toHaveProperty('sessionId');
    expect(snapshot).not.toHaveProperty('profileId');
    expect(snapshot).not.toHaveProperty('marketingConsent');
  });

  // Test 5: A user can change the saved language from Hebrew to English.
  it('changes the language from Hebrew to English', async () => {
    const existingProfile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(existingProfile);
    repository.save.mockImplementation(async (profile: UserProfileEntity) => profile);

    const result = await service.updateLanguage('session-1', 'en');

    // The selected language is changed and then saved.
    expect(result.language).toBe('en');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
    );
  });

  // Test 6: A user can change the saved language from English back to Hebrew.
  it('changes the language from English back to Hebrew', async () => {
    const existingProfile = createFakeProfile('profile-1', 'session-1', 'en');
    repository.findOneBy.mockResolvedValue(existingProfile);
    repository.save.mockImplementation(async (profile: UserProfileEntity) => profile);

    const result = await service.updateLanguage('session-1', 'he');

    // A user can change the preference back to Hebrew.
    expect(result.language).toBe('he');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'he' }),
    );
  });

  // Test 8: An unsupported language is rejected and does not overwrite saved data.
  it('rejects an unsupported language without saving a change', async () => {
    const existingProfile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(existingProfile);

    // The service must only accept the two required languages.
    await expect(
      service.updateLanguage('session-1', 'fr'),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Invalid input must not overwrite the saved language.
    expect(repository.save).not.toHaveBeenCalled();
    expect(existingProfile.language).toBe('he');
  });

  // Week 3, Test 1: Save every profile field collected for an anonymous visitor.
  it('updates all Week 3 fields for the current anonymous session', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    const result = await service.updateCurrentProfile('session-1', {
      preferredName: 'Rachel',
      grammaticalForm: 'feminine',
      email: 'rachel.demo@example.com',
      phone: '+972-50-9876543',
      serviceConsent: {
        granted: true,
        grantedAt: '2026-09-06T10:30:00.000Z',
        channel: 'web',
        policyVersion: 'v1.0',
      },
      marketingConsent: { granted: false },
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredName: 'Rachel',
        grammaticalForm: 'feminine',
        email: 'rachel.demo@example.com',
        phone: '+972-50-9876543',
        serviceConsent: {
          granted: true,
          grantedAt: '2026-09-06T10:30:00.000Z',
          channel: 'web',
          policyVersion: 'v1.0',
        },
        marketingConsent: { granted: false },
      }),
    );
    expect(result).toMatchObject({
      id: 'profile-1',
      sessionId: 'session-1',
      preferredName: 'Rachel',
      grammaticalForm: 'feminine',
      email: 'rachel.demo@example.com',
      phone: '+972-50-9876543',
    });
  });

  // Week 3, Test 2: PATCH updates must preserve fields that were not submitted.
  it('preserves existing fields that are absent from a partial update', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      email: 'existing.demo@example.com',
      phone: '+972-50-1111111',
      serviceConsent: {
        granted: true,
        grantedAt: '2026-09-01T10:00:00.000Z',
        channel: 'web',
        policyVersion: 'v1.0',
      },
    });
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    const result = await service.updateCurrentProfile('session-1', {
      preferredName: 'Rachel',
    });

    expect(result).toMatchObject({
      preferredName: 'Rachel',
      email: 'existing.demo@example.com',
      phone: '+972-50-1111111',
      serviceConsent: {
        granted: true,
        grantedAt: '2026-09-01T10:00:00.000Z',
        channel: 'web',
        policyVersion: 'v1.0',
      },
    });
  });

  // Week 3, Test 3: Every grammatical form in the shared contract is accepted.
  it.each(['masculine', 'feminine', 'neutral', 'unspecified'] as const)(
    'accepts the supported grammatical form "%s"',
    async (grammaticalForm) => {
      const profile = createFakeProfile('profile-1', 'session-1', 'he');
      repository.findOneBy.mockResolvedValue(profile);
      repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

      const result = await service.updateCurrentProfile('session-1', { grammaticalForm });

      expect(result.grammaticalForm).toBe(grammaticalForm);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ grammaticalForm }),
      );
    },
  );

  // Week 3, Test 4: Invalid grammatical forms must not overwrite stored data.
  it('rejects an unsupported grammatical form without saving changes', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      grammaticalForm: 'feminine',
    });
    repository.findOneBy.mockResolvedValue(profile);

    await expect(
      service.updateCurrentProfile('session-1', { grammaticalForm: 'unknown' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
    expect(profile.grammaticalForm).toBe('feminine');
  });

  // Week 3, Test 5: Valid email is saved and invalid email leaves stored data unchanged.
  it.each([
    { email: 'valid.demo@example.com', shouldSucceed: true },
    { email: 'not-an-email', shouldSucceed: false },
  ])('validates email "%s"', async ({ email, shouldSucceed }) => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      email: 'existing.demo@example.com',
    });
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    if (shouldSucceed) {
      const result = await service.updateCurrentProfile('session-1', { email });

      expect(result.email).toBe(email);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ email }));
      return;
    }

    await expect(service.updateCurrentProfile('session-1', { email })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(profile.email).toBe('existing.demo@example.com');
  });

  // Week 3, Test 6: Non-empty phone is saved and blank phone leaves stored data unchanged.
  it.each([
    { phone: '+972-50-1234567', shouldSucceed: true },
    { phone: '', shouldSucceed: false },
    { phone: '   ', shouldSucceed: false },
    // Too short, too long, and non-numeric values must be rejected.
    { phone: '123', shouldSucceed: false },
    { phone: '1234567890123456', shouldSucceed: false },
    { phone: '050-abc-4567', shouldSucceed: false },
  ])('validates phone "%s"', async ({ phone, shouldSucceed }) => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      phone: '+972-50-0000000',
    });
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    if (shouldSucceed) {
      const result = await service.updateCurrentProfile('session-1', { phone });

      expect(result.phone).toBe(phone);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ phone }));
      return;
    }

    await expect(service.updateCurrentProfile('session-1', { phone })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(profile.phone).toBe('+972-50-0000000');
  });

  // Week 3, Test 7: Granted service consent retains its required evidence.
  it('stores service-consent evidence when consent is granted', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);
    const serviceConsent = {
      granted: true,
      grantedAt: '2026-09-06T10:30:00.000Z',
      channel: 'web',
      policyVersion: 'v1.0',
    };

    const result = await service.updateCurrentProfile('session-1', { serviceConsent });

    expect(result.serviceConsent).toEqual(serviceConsent);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ serviceConsent }),
    );
  });

  // Week 3, Test 8: Service and marketing consent change independently.
  it('updates service consent without changing marketing consent', async () => {
    const marketingConsent = {
      granted: true,
      grantedAt: '2026-09-01T10:00:00.000Z',
      channel: 'web',
      policyVersion: 'v1.0',
    };
    const profile = createFakeProfile('profile-1', 'session-1', 'he', { marketingConsent });
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    const result = await service.updateCurrentProfile('session-1', {
      serviceConsent: { granted: true },
    });

    expect(result.serviceConsent).toEqual({ granted: true });
    expect(result.marketingConsent).toEqual(marketingConsent);
  });

  // Week 3, Test 9: Marketing consent never grants service-contact permission.
  it('updates marketing consent without changing service consent', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he', {
      serviceConsent: { granted: false },
    });
    repository.findOneBy.mockResolvedValue(profile);
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    const result = await service.updateCurrentProfile('session-1', {
      marketingConsent: { granted: true },
    });

    expect(result.marketingConsent).toEqual({ granted: true });
    expect(result.serviceConsent).toEqual({ granted: false });
  });

  // Week 3, Test 10: An update must never affect a profile owned by another session.
  it('updates only the profile owned by the current anonymous session', async () => {
    const firstProfile = createFakeProfile('profile-1', 'session-1', 'he', {
      preferredName: 'First visitor',
    });
    const secondProfile = createFakeProfile('profile-2', 'session-2', 'en', {
      preferredName: 'Second visitor',
    });
    repository.findOneBy.mockImplementation(async ({ sessionId }) => {
      if (sessionId === 'session-1') return firstProfile;
      if (sessionId === 'session-2') return secondProfile;
      return null;
    });
    repository.save.mockImplementation(async (savedProfile: UserProfileEntity) => savedProfile);

    await service.updateCurrentProfile('session-1', { preferredName: 'Updated visitor' });

    expect(firstProfile.preferredName).toBe('Updated visitor');
    expect(secondProfile.preferredName).toBe('Second visitor');
    expect(repository.findOneBy).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  // Week 3, Test 11: Consent evidence validation rejects invalid evidence when consent is granted.
  it('rejects invalid consent evidence when consent is granted', async () => {
    const profile = createFakeProfile('profile-1', 'session-1', 'he');
    repository.findOneBy.mockResolvedValue(profile);

    // Invalid grantedAt date-time
    await expect(
      service.updateCurrentProfile('session-1', {
        serviceConsent: { granted: true, grantedAt: 'not-a-date' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Empty channel
    await expect(
      service.updateCurrentProfile('session-1', {
        serviceConsent: { granted: true, channel: '   ' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Empty policyVersion
    await expect(
      service.updateCurrentProfile('session-1', {
        serviceConsent: { granted: true, policyVersion: '' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  // Week 5, Test 1: Delete is scoped to the requesting session only.
  it('deletes only the profile scoped to the given session', async () => {
    repository.findOneBy.mockResolvedValue(
      createFakeProfile('profile-1', 'session-1', 'he'),
    );
    repository.delete.mockResolvedValue({ affected: 1 });

    await service.deleteBySessionId('session-1');

    expect(storage.deleteProfile).toHaveBeenCalledWith('profile-1');
    expect(repository.delete).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  // Week 5, Test 2: Deleting a session with no profile is idempotent, not an error.
  it('resolves without throwing when the session has no profile to delete', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.deleteBySessionId('session-without-profile')).resolves.toBeUndefined();
  });

  it('propagates a profile deletion failure', async () => {
    repository.findOneBy.mockResolvedValue(
      createFakeProfile('profile-1', 'session-1', 'he'),
    );
    storage.deleteProfile.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.deleteBySessionId('session-1'),
    ).rejects.toThrow('storage unavailable');

    expect(repository.delete).not.toHaveBeenCalled();
  });
});