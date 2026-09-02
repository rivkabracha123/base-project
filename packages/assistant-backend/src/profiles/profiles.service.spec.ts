import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UserProfileEntity } from '../database/user-profile.entity';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  // Keep the fake repository as Jest functions so test setup can use
  // mockResolvedValue, mockReturnValue, and mockImplementation.
  let repository: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: ProfilesService;

  const createFakeProfile = (
    id: string,
    sessionId: string,
    language: 'he' | 'en',
  ): UserProfileEntity => {
    // This fake entity includes the same conversion method as the real entity.
    // Its language is read at conversion time, after an update may have changed it.
    const profile = { id, sessionId, language } as UserProfileEntity;
    profile.toUserProfile = () => ({
      id: profile.id,
      sessionId: profile.sessionId,
      language: profile.language as 'he' | 'en',
      serviceConsent: { granted: false },
      marketingConsent: { granted: false },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    return profile;
  };

  beforeEach(() => {
    // Create a fresh fake repository before every test.
    // It replaces the real database, so no real profile data is changed.
    repository = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // The service does not exist yet. This line is intentional in TDD:
    // the test should fail until the service is implemented.
    service = new ProfilesService(
      repository as unknown as Repository<UserProfileEntity>,
    );
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
});