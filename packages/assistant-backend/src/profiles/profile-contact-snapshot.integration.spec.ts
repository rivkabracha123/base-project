import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { profileContactSnapshotSchema, toProfileContactSnapshot } from '@monabid/shared';
import type { UserProfile } from '@monabid/shared';
import { UserProfileEntity } from '../database/user-profile.entity';
import { LocalFileStorage } from '../storage/local-file-storage.service';
import pinoHttp from 'pino-http';
import { HTTP_LOG_REDACT_PATHS } from '../common/http-logger';
import { ProfilesModule } from './profiles.module';

/**
 * [Week 4 - Avishag - Task: "Connect the minimum fields needed by Buyer,
 * Seller, and dashboard"]
 *
 * This is the ONE integration test the task asks for. It proves the
 * Profiles <-> Buyer/Seller/Dashboard boundary end to end: a real HTTP
 * request goes through the real ProfilesController, ProfilesService, and
 * UserProfileEntity, and the resulting UserProfile can always be turned
 * into a valid ProfileContactSnapshot (the shared contract).
 *
 * Only the database repository is faked (same pattern already used in
 * lots.integration.spec.ts) - everything else is the real, wired-up module.
 * This test does NOT exercise any Buyer/Seller/Dashboard code - only the
 * shape those features are allowed to depend on.
 */
describe('Profiles <-> ProfileContactSnapshot contract (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const FIXTURE_TIME = new Date('2026-10-11T09:00:00.000Z');

  // In-memory row store keyed by sessionId - stands in for Postgres.
  let rows: Map<string, UserProfileEntity>;
  const logLines: string[] = [];
  const storage = {
    deleteProfile: jest.fn(() => Promise.resolve()),
  };

  const repository = {
    findOneBy: jest.fn(({ sessionId }: { sessionId: string }) =>
      Promise.resolve(rows.get(sessionId) ?? null),
    ),
    // Mirrors TypeORM's repository.create(): builds a real entity instance
    // (with its real toUserProfile() method) from plain field data.
    create: jest.fn((data: Partial<UserProfileEntity>) =>
      Object.assign(new UserProfileEntity(), data),
    ),
    // Mirrors TypeORM's @CreateDateColumn/@UpdateDateColumn behavior, since
    // the fake repository has no real database to fill those in for us.
    save: jest.fn((entity: UserProfileEntity) => {
      entity.createdAt = entity.createdAt ?? FIXTURE_TIME;
      entity.updatedAt = FIXTURE_TIME;
      rows.set(entity.sessionId, entity);
      return Promise.resolve(entity);
    }),
    // Mirrors TypeORM's repository.delete(): removes matching rows, never throws when none match.
    delete: jest.fn(({ sessionId }: { sessionId: string }) => {
      const affected = rows.delete(sessionId) ? 1 : 0;
      return Promise.resolve({ affected, raw: [] });
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProfilesModule] })
      .overrideProvider(getRepositoryToken(UserProfileEntity))
      .useValue(repository)
      .overrideProvider(LocalFileStorage)
      .useValue(storage)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror the global HTTP configuration from main.ts.
    // Same logger options as production, but written to an in-memory array.
    app.use(
      pinoHttp({ level: 'info', redact: HTTP_LOG_REDACT_PATHS }, {
        write: (line: string) => logLines.push(line),
      }),
    );
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    rows = new Map();
    logLines.length = 0;
    jest.clearAllMocks();
    storage.deleteProfile.mockResolvedValue(undefined);
  });

  it('derives a valid ProfileContactSnapshot from a brand-new anonymous profile', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-new-1' },
    });
    const profile = (await response.json()) as UserProfile;

    expect(response.status).toBe(200);

    const snapshot = toProfileContactSnapshot(profile);
    expect(() => profileContactSnapshotSchema.parse(snapshot)).not.toThrow();
    expect(snapshot.serviceConsentGranted).toBe(false);
  });

  it('exposes only the privacy-safe contact snapshot for downstream consumers', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me/contact-snapshot`, {
      headers: { 'x-anonymous-session-id': 'sess-b4-contract-1' },
    });
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot).toEqual({
      preferredName: null,
      email: null,
      phone: null,
      serviceConsentGranted: false,
    });
    expect(snapshot).not.toHaveProperty('sessionId');
    expect(snapshot).not.toHaveProperty('profileId');
    expect(snapshot).not.toHaveProperty('marketingConsent');
  });

  it('rejects a profile request without an anonymous session ID', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me`);

    expect(response.status).toBe(400);
  });

  it.each([
    ['whitespace-only session', '   '],
    ['empty session', ''],
  ])('rejects an invalid anonymous session: %s', async (_label, sessionId) => {
    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': sessionId },
    });

    expect(response.status).toBe(400);
  });

  it.each([
    ['hostile characters', '<script>alert(1)</script>'],
    ['SQL injection attempt', "x'; DROP TABLE user_profile;--"],
    ['too short', 'abc'],
    ['too long', 'a'.repeat(500)],
  ])('rejects a malformed anonymous session format: %s', async (_label, sessionId) => {
    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': sessionId },
    });

    expect(response.status).toBe(400);
    // No profile may be created for a rejected session.
    expect(rows.size).toBe(0);
  });

  it('does not write contact details or the session ID to the request log', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me/contact`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-anonymous-session-id': 'sess-log-privacy-1' },
      body: JSON.stringify({
        email: 'log-private@example.test',
        phone: '0501234567',
        consentGranted: true,
      }),
    });
    expect(response.status).toBeLessThan(500);

    const output = logLines.join('');
    // Sanity check: the request really was logged, so the assertions below are meaningful.
    expect(output).toContain('request completed');
    expect(output).not.toContain('log-private@example.test');
    expect(output).not.toContain('0501234567');
    expect(output).not.toContain('sess-log-privacy-1');
  });

  it('uses deterministic timestamps for the profile fixture', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-deterministic-1' },
    });
    const profile = (await response.json()) as UserProfile;

    expect(profile.createdAt).toBe(FIXTURE_TIME.toISOString());
    expect(profile.updatedAt).toBe(FIXTURE_TIME.toISOString());
  });

  it('rejects profile update fields that are not defined by the DTO', async () => {
    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-anonymous-session-id': 'sess-validation-test',
      },
      body: JSON.stringify({
        preferredName: 'Dana',
        // Clients must not be able to choose or overwrite the profile session ID.
        sessionId: 'someone-elses-session',
      }),
    });

    // The global ValidationPipe rejects unknown DTO properties before the controller runs.
    expect(response.status).toBe(400);
  });

  it('exposes enough fields for a Buyer help request / Seller lead once the profile is completed', async () => {
    // Create the anonymous profile first, same as a real visitor would.
    await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-complete-1' },
    });

    const patchResponse = await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-anonymous-session-id': 'sess-complete-1',
      },
      body: JSON.stringify({
        preferredName: 'Dana',
        email: 'dana@example.com',
        serviceConsent: { granted: true },
      }),
    });
    const profile = (await patchResponse.json()) as UserProfile;
    const snapshot = toProfileContactSnapshot(profile);

    expect(profileContactSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    // Product rule (spec: "Minimum contact requirements"): a buyer help
    // request / seller lead needs a preferred name, either email or phone,
    // and explicit service-contact consent.
    expect(snapshot.preferredName).toBe('Dana');
    expect(snapshot.email || snapshot.phone).toBeTruthy();
    expect(snapshot.serviceConsentGranted).toBe(true);
  });

  // Week 5, Test 3: Deletion is scoped to the calling session and is real, not a soft flag.
  it('deletes only the calling session profile and starts fresh on the next visit', async () => {
    await fetch(`${baseUrl}/api/profiles/me`, { headers: { 'x-anonymous-session-id': 'sess-victim' } });
    await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-anonymous-session-id': 'sess-victim' },
      body: JSON.stringify({ preferredName: 'Dana' }),
    });
    await fetch(`${baseUrl}/api/profiles/me`, { headers: { 'x-anonymous-session-id': 'sess-bystander' } });
    await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-anonymous-session-id': 'sess-bystander' },
      body: JSON.stringify({ preferredName: 'Noa' }),
    });

    const deleteResponse = await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'DELETE',
      headers: { 'x-anonymous-session-id': 'sess-victim' },
    });
    expect(deleteResponse.status).toBe(204);

    // The other session's profile must be untouched.
    const bystanderResponse = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-bystander' },
    });
    expect((await bystanderResponse.json()).preferredName).toBe('Noa');

    // The deleted session gets a brand-new, empty profile - not the old one.
    const revisitResponse = await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-victim' },
    });
    expect((await revisitResponse.json()).preferredName).toBeNull();
  });

  it('does not report successful deletion when storage fails', async () => {
    await fetch(`${baseUrl}/api/profiles/me`, {
      headers: { 'x-anonymous-session-id': 'sess-delete-failure' },
    });
    storage.deleteProfile.mockRejectedValueOnce(new Error('storage unavailable'));

    const response = await fetch(`${baseUrl}/api/profiles/me`, {
      method: 'DELETE',
      headers: { 'x-anonymous-session-id': 'sess-delete-failure' },
    });

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.status).not.toBe(204);
  });
});
