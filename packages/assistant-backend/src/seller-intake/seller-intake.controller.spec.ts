import { INestApplication, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeService } from './seller-intake.service';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { P4AiGenerateClient } from '../ai/p4-ai-generate.client';
import { SellerIntakeAiAdapter } from './seller-intake-ai.adapter';
import { SELLER_INTAKE_AI_PROVIDER } from './seller-intake-ai.provider';
import { SellerIntakeDraftsService } from './seller-intake-drafts.service';
import { UploadsService } from '../uploads/uploads.service';

// Tests for the Seller Intake Controller.
// Verifies that the API accepts seller messages and returns a draft item,
// and that invalid requests are rejected.
describe('SellerIntakeController', () => {
  let app: INestApplication;
  let baseUrl: string;
  let persistedDraft: Record<string, any>;
  const aiGenerate = jest.fn(async () => { throw new ServiceUnavailableException('down'); });
  const extractedPainting = {
    provider: 'real', mode: 'real', isRelevant: true, error: null,
    structuredAnswer: {
      role: 'seller', language: 'en', intent: 'Sell a painting', category: 'paintings',
      item: { title: 'Oil painting', signature: 'Signed', dimensions: { values: [
        { label: 'width', value: 60, unit: 'cm' }, { label: 'height', value: 80, unit: 'cm' },
      ] } }, missingFacts: ['condition', 'markings', 'provenance'], confirmedFacts: [], uncertainFacts: [],
      sellerConfirmation: { required: true, status: 'pending' }, hasContactDetails: false, hasImages: false,
    },
  };
  const drafts = {
    saveIntakeTurn: jest.fn(async (_profileId: string, _sessionId: string, draft: Record<string, any>) => {
      persistedDraft = { profileId: _profileId, sessionId: _sessionId, draft };
      return persistedDraft;
    }),
    getDraft: jest.fn(async (profileId: string, sessionId: string) => {
      if (!persistedDraft || persistedDraft.profileId !== profileId || persistedDraft.sessionId !== sessionId) {
        throw new NotFoundException('Draft not found');
      }
      return persistedDraft;
    }),
    correctDraft: jest.fn(async (profileId: string, sessionId: string, field: unknown, value: unknown) => ({ profileId, sessionId, field, value })),
    confirmFacts: jest.fn(async (profileId: string, sessionId: string, fields: unknown) => ({ profileId, sessionId, fields })),
  };

  // Fixed mock data for the tests.
  // The data is defined here so the test does not depend on an external JSON file.
  const mockDraft = {
    status: 'draft' as const,

    item: {
      category: 'paintings',
      title: 'Oil painting',
    },

    // The seller has not confirmed the extracted facts yet.
    confirmedFacts: {},

    // There are no uncertain facts in this test draft.
    uncertainFacts: [],

    // No external evidence is used in this test.
    evidence: [],

    // The initial draft has no revision history.
    revisionHistory: [],

    // The seller is required to confirm the extracted facts.
    sellerConfirmation: {
      required: true,
      status: 'pending' as const,
    },

    // The draft is ready to be reviewed by the next stages.
    handoff: {
      to: ['s3', 's4', 's5'],
      status: 'ready_for_review' as const,
      notes: 'Only confirmed SellerItem facts are trusted downstream.',
    },

    // Required safety rules for the seller intake process.
    safetyRules: {
      sellerConfirmsExtractedFacts: true,
      askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
      weakEvidenceNeverProducesInventedPrice: true,
      noHouseRecommendation: true,
      noValuation: true,
      noContactCapture: true,
    },

    // Indicates that the response comes from the test mock.
    provider: 'fixture-mock' as const,
  };

  // Create a real NestJS application before running the tests.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SellerIntakeController],
      providers: [
        SellerIntakeService,
        SellerIntakeAiMock,
        SellerIntakeAiAdapter,
        { provide: SELLER_INTAKE_AI_PROVIDER, useExisting: SellerIntakeAiAdapter },
        { provide: P4AiGenerateClient, useValue: { generateSellerExtract: aiGenerate } },
        { provide: SellerIntakeDraftsService, useValue: drafts },
        // הבדיקות כאן לא מעלות תמונות; העלאת תמונות נבדקת ב-seller-intake-photos.http.spec.ts.
        { provide: UploadsService, useValue: {} },
      ],
    })
      .compile();

    // Create the NestJS application used for the API test.
    app = moduleRef.createNestApplication();

    // Start the test server on an automatically assigned available port.
    await app.listen(0);

    // Get the port on which the test server is running.
    const address = app.getHttpServer().address();

    if (typeof address === 'object' && address !== null) {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error('Could not determine test server port');
    }
  });

  // Close the test server after all tests finish.
  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    persistedDraft = undefined as never;
    jest.clearAllMocks();
  });

  // Verify the Week 3 normal path: dimensions and signature are present, while condition, marks, and provenance are missing.
  it('restores a persisted item before routing a recommendation without an AI call', async () => {
    persistedDraft = { profileId: 'profile-restored', sessionId: 'session-restored',
      draft: app.get(SellerIntakeAiMock).analyze('oil painting') };
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Which auction houses are recommended?',
        profileId: 'profile-restored', sessionId: 'session-restored' }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ nextQuestion: null,
      functionCall: { functionToRun: 'rankSellerHouses', object: { category: 'paintings' } } });
    expect(aiGenerate).not.toHaveBeenCalled();
  });

  it('asks for the remaining required Week 3 details on the normal path', async () => {
    aiGenerate.mockResolvedValueOnce(extractedPainting as never);
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },

      // Send a seller message through a real HTTP request.
      body: JSON.stringify({
        input: 'I have an oil painting, 60 x 80 cm, signed.',
        profileId: 'profile-test',
        sessionId: 'session-test',
      }),
    });

    // A successful POST request should return HTTP 201.
    expect(response.status).toBe(201);

    const body = await response.json();

    // Verify that the response contains a draft item.
    expect(body.status).toBe('draft');

    // Verify that the response came from the test mock.
    expect(body.provider).toBe('fixture-mock');

    // Verify that seller confirmation is required.
    expect(body.sellerConfirmation.required).toBe(true);

    // Extracted fixture facts must remain unconfirmed until seller approval.
    expect(body.confirmedFacts).toEqual({});

    // Verify that missing details are derived from the seller's message and that marks remain distinct from signatures.
    expect(body.missingFields).toEqual(['condition', 'marks', 'provenance']);
    expect(body.nextQuestion.field).toBe('condition');
    expect(body.nextQuestion.he).toContain('מצב');
    expect(body.nextQuestion.en).toContain('condition');

    // Verify that the draft can be handed off to S3, S4, and S5.
    expect(body.handoff.to).toEqual(['s3', 's4', 's5']);

    // Verify that weak evidence cannot produce an invented price.
    expect(body.safetyRules.weakEvidenceNeverProducesInventedPrice).toBe(true);
    expect(drafts.saveIntakeTurn).toHaveBeenCalledWith('profile-test', 'session-test', expect.objectContaining({
      seller: expect.objectContaining({ anonymousProfileId: 'profile-test' }),
      id: expect.stringMatching(/^seller-draft-/),
    }));
    expect(body).not.toHaveProperty('sessionId');

    expect(JSON.stringify(body)).not.toMatch(/phone|email|password|credential|signed.?url/i);
  });

  // Verify the Week 3 failure path for invalid input.
  it('rejects an empty seller message with 400', async () => {
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },

      // Send an empty input.
      body: JSON.stringify({ input: '', profileId: 'profile-test', sessionId: 'session-test' }),
    });

    // The controller should return HTTP 400 for invalid input.
    expect(response.status).toBe(400);
  });

  it('does not log the seller message or sensitive fields', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const sellerMessage = 'Private seller conversation with phone 555-0100';

    await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: sellerMessage, profileId: 'profile-test', sessionId: 'session-log-test' }),
    });

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(sellerMessage));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringMatching(/phone|email|password|credential|signed.?url/i));
    logSpy.mockRestore();
  });

  it('exposes persisted draft read, correction, and seller confirmation routes', async () => {
    const initialResponse = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'I have a painting.', profileId: 'profile-test', sessionId: 'session-flow' }),
    });
    expect(initialResponse.status).toBe(201);

    const readResponse = await fetch(`${baseUrl}/seller-intake/draft/profile-test/session-flow`);
    expect(readResponse.status).toBe(200);
    expect(drafts.getDraft).toHaveBeenCalledWith('profile-test', 'session-flow');

    const correctionResponse = await fetch(`${baseUrl}/seller-intake/draft/profile-test/session-flow/corrections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'provenance', value: 'Family archive' }),
    });
    expect(correctionResponse.status).toBe(200);
    expect(drafts.correctDraft).toHaveBeenCalledWith('profile-test', 'session-flow', 'provenance', 'Family archive');

    const confirmationResponse = await fetch(`${baseUrl}/seller-intake/draft/profile-test/session-flow/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: ['dimensions', 'condition'] }),
    });
    expect(confirmationResponse.status).toBe(201);
    expect(drafts.confirmFacts).toHaveBeenCalledWith('profile-test', 'session-flow', ['dimensions', 'condition']);
  });

  // Without profileId and sessionId the message is analyzed but nothing is persisted.
  it('returns a draft without persisting it when no profileId and sessionId are sent', async () => {
    aiGenerate.mockResolvedValueOnce(extractedPainting as never);
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'I have an oil painting, 60 x 80 cm, signed.' }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.status).toBe('draft');
    expect(body.missingFields).toEqual(['condition', 'marks', 'provenance']);
    expect(body).not.toHaveProperty('sessionId');
    expect(drafts.saveIntakeTurn).not.toHaveBeenCalled();
  });

  // Sending only one of the two identifiers is a client mistake and must not be silently ignored.
  it('rejects a request that sends only profileId with 400', async () => {
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'I have a painting.', profileId: 'profile-test' }),
    });

    expect(response.status).toBe(400);
    expect(drafts.saveIntakeTurn).not.toHaveBeenCalled();
  });

  it('rejects a request that sends only sessionId with 400', async () => {
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'I have a painting.', sessionId: 'session-test' }),
    });

    expect(response.status).toBe(400);
    expect(drafts.saveIntakeTurn).not.toHaveBeenCalled();
  });

  it('returns a function call from the AI provider in the intake response', async () => {
    const functionCall = { functionToRun: 'listEvidence', object: { itemId: 'seller-item' } };
    aiGenerate.mockResolvedValue({
      provider: 'real', mode: 'real', isRelevant: true, error: null,
      structuredAnswer: {
        role: 'seller', language: 'en', intent: 'Show uploaded images', category: 'paintings',
        item: { title: 'Oil painting' }, missingFacts: ['dimensions'], confirmedFacts: [], uncertainFacts: [],
        sellerConfirmation: { required: true, status: 'pending' }, hasContactDetails: false, hasImages: false,
      }, functionCall,
    } as never);

    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Show my uploaded images', profileId: 'profile-test', sessionId: 'session-function' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ functionCall }));
  });
});
