import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeService } from './seller-intake.service';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';

// Tests for the Seller Intake Controller.
// Verifies that the API accepts seller messages and returns a draft item,
// and that invalid requests are rejected.
describe('SellerIntakeController', () => {
  let app: INestApplication;
  let baseUrl: string;

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
      providers: [SellerIntakeService, SellerIntakeAiMock],
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

  // Verify the Week 3 normal path: dimensions and signature are present, while condition, marks, and provenance are missing.
  it('asks for the remaining required Week 3 details on the normal path', async () => {
    const response = await fetch(`${baseUrl}/seller-intake/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },

      // Send a seller message through a real HTTP request.
      body: JSON.stringify({
        input: 'I have an oil painting, 60 x 80 cm, signed.',
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

    // Verify that the draft can be handed off to S3, S4, and S5.
    expect(body.handoff.to).toEqual(['s3', 's4', 's5']);

    // Verify that weak evidence cannot produce an invented price.
    expect(body.safetyRules.weakEvidenceNeverProducesInventedPrice).toBe(true);

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
      body: JSON.stringify({
        input: '',
      }),
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
      body: JSON.stringify({ input: sellerMessage }),
    });

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(sellerMessage));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringMatching(/phone|email|password|credential|signed.?url/i));
    logSpy.mockRestore();
  });
});
