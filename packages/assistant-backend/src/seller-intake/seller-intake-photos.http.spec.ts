import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiService } from '../ai/ai.service';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { UploadsModule } from '../uploads/uploads.module';
import { SellerIntakeAiAdapter } from './seller-intake-ai.adapter';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SELLER_INTAKE_AI_PROVIDER } from './seller-intake-ai.provider';
import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { SellerIntakeService } from './seller-intake.service';

// S1 receives the seller's photos from the chat (B1), hands them to S2 for storage, and attaches the
// returned references to the seller's draft. The file rules (type, size, up to 10) are S2's and tested there.
describe('SellerIntakeController photos (HTTP)', () => {
  let app: INestApplication;
  let root: string;
  let baseUrl: string;
  const drafts = {
    attachEvidence: jest.fn(async () => ({ version: 2 })),
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'monabid-seller-intake-photos-'));
    drafts.attachEvidence.mockClear();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ LOCAL_STORAGE_PATH: root })] }),
        UploadsModule,
      ],
      controllers: [SellerIntakeController],
      providers: [
        SellerIntakeService,
        SellerIntakeAiMock,
        SellerIntakeAiAdapter,
        { provide: SELLER_INTAKE_AI_PROVIDER, useExisting: SellerIntakeAiAdapter },
        { provide: AiService, useValue: { generate: jest.fn() } },
        { provide: SellerIntakeDraftsService, useValue: drafts },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Failed to get test server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  function photosForm(...names: string[]) {
    const form = new FormData();
    names.forEach((name) => form.append('files', new Blob(['pixels'], { type: 'image/jpeg' }), name));
    return form;
  }

  function uploadPhotos(form: FormData, profileId = 'profile-p3', sessionId = 'session-1') {
    return fetch(`${baseUrl}/seller-intake/draft/${profileId}/${sessionId}/photos`, { method: 'POST', body: form });
  }

  // העלאה אחת = פריט אחד: כל התמונות מקבלות אותו itemId, ונשמרות אצל S2 תחת הפרופיל שהצ'אט הביא מ-P3.
  it('stores all photos of one upload as one item under the profile it was given', async () => {
    const response = await uploadPhotos(photosForm('front.jpg', 'back.jpg'));

    expect(response.status).toBe(201);
    const references = await response.json();
    expect(references).toHaveLength(2);
    expect(new Set(references.map((reference: { itemId: string }) => reference.itemId)).size).toBe(1);
    expect(references.every((reference: { profileId: string }) => reference.profileId === 'profile-p3')).toBe(true);

    const stored = await (await fetch(`${baseUrl}/evidence/profile-p3`)).json();
    expect(stored).toHaveLength(2);
  });

  // התשובה כוללת רק את התמונות של ההעלאה הזאת, ולא תמונות ישנות של אותו פרופיל.
  it('returns only the photos of this upload, not earlier photos of the same profile', async () => {
    await uploadPhotos(photosForm('first.jpg'));

    const response = await uploadPhotos(photosForm('second.jpg'));
    const references = await response.json();

    expect(references).toHaveLength(1);
    expect(references[0].originalName).toBe('second.jpg');
  });

  // S1 מצרפת את ההפניות לטיוטה של אותו פרופיל ואותה שיחה.
  it('attaches the stored references to the draft of the same profile and session', async () => {
    const response = await uploadPhotos(photosForm('front.jpg'), 'profile-p3', 'session-9');
    const references = await response.json();

    expect(drafts.attachEvidence).toHaveBeenCalledWith('profile-p3', 'session-9', references);
  });

  // אם S2 דוחה את הקבצים, שום דבר לא מצורף לטיוטה והשגיאה מגיעה לצ'אט.
  it('does not touch the draft when the upload is rejected', async () => {
    const form = new FormData();
    form.append('files', new Blob(['notes'], { type: 'application/pdf' }), 'notes.pdf');

    const response = await uploadPhotos(form);

    expect(response.status).toBe(400);
    expect(drafts.attachEvidence).not.toHaveBeenCalled();
  });

  // כשעדיין אין טיוטה, התמונות עדיין נשמרות ומוחזרות.
  it('still stores and returns the photos when there is no draft yet', async () => {
    drafts.attachEvidence.mockResolvedValueOnce(null as never);

    const response = await uploadPhotos(photosForm('front.jpg'));

    expect(response.status).toBe(201);
    expect(await response.json()).toHaveLength(1);
  });
});
