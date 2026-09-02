import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeService } from './seller-intake.service';

/**
 * Test suite for SellerIntakeService
 *
 * Validates the complete seller intake flow:
 * 1. Input parsing: extract facts from raw seller text input
 * 2. Draft creation: build initial unconfirmed draft with extracted and uncertain facts
 * 3. Fixture-mode deterministic output: use mock provider with fixture data for reproducible tests
 * 4. API contract: ensure controller returns the full SellerItemDraft with handoff payload
 * 5. Data safety: confirmed facts stay separate from uncertain/missing fields; sensitive data is not leaked
 *
 * The suite uses a deterministic fixture (seller-item-draft.json) instead of live external APIs,
 * ensuring tests are fast, reproducible, and independent of provider availability.
 */
describe('SellerIntakeService', () => {
  // Load the deterministic fixture used by SellerIntakeAiMock
  const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-item-draft.json');

  // Test 1: Input parsing enforces fact extraction without invention
  it('extracts only facts explicitly present in seller input', () => {
    const service = new SellerIntakeService();
    const input = 'I have an item that is 40 x 30 cm, signed, and described as wooden. I am not sure about the maker.';
    const extracted = service.parseSellerInput(input);

    expect(extracted.dimensions.widthCm).toBe(40);
    expect(extracted.dimensions.heightCm).toBe(30);

    expect(extracted.markings).toBeTruthy();
    expect(extracted.markings).not.toBe('Not yet confirmed');

    expect(extracted.provenance).toBeUndefined();
    expect(extracted.materials).not.toContain('oil');
    expect(extracted.materials).not.toContain('canvas');
    expect(extracted.materials).not.toContain('metal');
  });

  // Test 2: Initial draft marks all extracted data as unconfirmed and flags missing required fields
  it('creates an unconfirmed initial draft from seller input', () => {
    const service = new SellerIntakeService();
    const draft = service.createInitialDraft('יש לי ציור בגודל 60 על 80 ס"מ, והוא חתום.');

    expect(draft.status).toBe('draft');
    expect(draft.extractedFacts.category).toBe('paintings');
    expect(draft.extractedFacts.dimensions).toEqual({ widthCm: 60, heightCm: 80 });
    expect(draft.extractedFacts.markings).toBe('Signed lower right');
    expect(draft.confirmedFacts).toEqual({});
    expect(draft.sellerConfirmation).toEqual({ required: true, status: 'pending' });
    expect(draft.missingFields).toContain('provenance');
  });

  // Test 3: Mock provider reads from fixture and returns deterministic SellerItemDraft
  // This test validates that the fixture file is properly formatted and matches the contract
  it('uses deterministic fixture-mode output for seller intake', () => {
    const service = new SellerIntakeService();
    const aiMock = new SellerIntakeAiMock(service);
    const draft = aiMock.analyze('יש לי ציור בגודל 60 על 80 ס"מ, והוא חתום.');

    expect(draft.provider).toBe('fixture-mock');
    expect(draft.id).toBe('seller-item-draft-001');
    expect(draft.item).toMatchObject({
      category: 'paintings',
      dimensions: {
        widthCm: 60,
        heightCm: 80,
        unit: 'cm',
      },
    });
    expect(draft.confirmedFacts).toMatchObject({
      category: 'paintings',
      dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80 }),
    });
  });
  // Test 4: Confirmed and uncertain facts are tracked separately
  // Confirmed facts are safe for downstream use; uncertain facts require manual review before valuation 
   it('keeps uncertain or missing information separate from the trusted draft', () => {
    const service = new SellerIntakeService();
    const input = 'I have a painting. It is 60 x 80 cm and signed. I think it was made in the 1980s.';
    const reviewState = service.buildReviewState(input);
    const draft = service.createDraftSellerItem(fixture);

    expect(reviewState.missingFields).toContain('provenance');
    expect(reviewState.uncertainFields).toContain('materials');
    expect(reviewState.uncertainFields).not.toContain('category');

    expect(draft.confirmedFacts).toEqual(expect.objectContaining({
      category: 'paintings',
      dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80 }),
    }));
    expect(draft.uncertainFacts.some((fact: { field: string }) => fact.field === 'era')).toBe(true);
  });

  // Test 5: Full API flow: controller receives seller input, passes to AI mock, returns complete SellerItemDraft
  // This validates the entire request-response cycle for the seller-intake POST endpoint
  it('accepts seller intake via API and returns the full fixture-backed draft', () => {
    const service = new SellerIntakeService();
    const controller = new SellerIntakeController(new SellerIntakeAiMock(service));

    const result = controller.createDraft('יש לי ציור בגודל 60 , 80 , והוא חתום.');

    expect(result).toMatchObject({
      id: 'seller-item-draft-001',
      status: 'draft',
      provider: 'fixture-mock',
      language: {
        preferred: 'he',
        secondary: 'en',
        conversationMode: 'bilingual',
      },
      seller: {
        anonymousProfileId: 'profile-demo-001',
        name: 'Maya Cohen',
        preferredName: 'Maya',
      },
      item: {
        category: 'paintings',
        title: 'Abstract landscape study',
        dimensions: {
          widthCm: 60,
          heightCm: 80,
          unit: 'cm',
        },
        source: 'seller-intake',
      },
      confirmedFacts: expect.objectContaining({
        category: 'paintings',
        dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80 }),
      }),
      handoff: expect.objectContaining({
        status: 'ready_for_review',
        to: expect.arrayContaining(['s3', 's4', 's5']),
      }),
      sellerConfirmation: expect.objectContaining({
        required: true,
        status: 'partial',
      }),
      safetyRules: {
        sellerConfirmsExtractedFacts: true,
        askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
        weakEvidenceNeverProducesInventedPrice: true,
        noHouseRecommendation: true,
        noValuation: true,
        noContactCapture: true,
      },
    });

    // Verify supporting data is included: evidence trail and revision history
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(Array.isArray(result.revisionHistory)).toBe(true);
    expect(result.revisionHistory.length).toBeGreaterThan(0);
    expect(result.uncertainFacts.some((fact: { field: string }) => fact.field === 'era')).toBe(true);
  });

  // Test 6: Draft item is properly structured and handoff metadata is ready for downstream consumers
  it('creates a draft item and prepares a safe handoff', () => {
    const service = new SellerIntakeService();
    const draft = service.createDraftSellerItem(fixture);

    expect(draft.item).toEqual(expect.objectContaining({
      category: 'paintings',
      materials: expect.arrayContaining(['oil', 'canvas']),
      dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80 }),
    }));
    expect(draft.handoff.to).toEqual(expect.arrayContaining(['s3', 's4', 's5']));
    expect(draft.safetyRules).toMatchObject({
      sellerConfirmsExtractedFacts: true,
      askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
      weakEvidenceNeverProducesInventedPrice: true,
      noValuation: true,
      noHouseRecommendation: true,
      noContactCapture: true,
    });
  });

  // Test 7: Full contract validation - the SellerItemDraft matches the authoritative schema
  // and includes all required fields for Week 2 handoff (Tamar Zingerovitz boundary)
  it('returns a SellerItemDraft contract fit for downstream handoff', () => {
    const service = new SellerIntakeService();
    const draft = service.createDraftSellerItem(fixture);

    expect(draft).toEqual(expect.objectContaining({
      id: 'seller-item-draft-001',
      feature: 'seller-conversation',
      developer: 's1',
      week: 2,
      status: 'draft',
      language: expect.objectContaining({
        preferred: 'he',
        secondary: 'en',
        conversationMode: 'bilingual',
      }),
      seller: expect.objectContaining({
        anonymousProfileId: 'profile-demo-001',
        name: 'Maya Cohen',
        preferredName: 'Maya',
      }),
      item: expect.objectContaining({
        category: 'paintings',
        title: 'Abstract landscape study',
        source: 'seller-intake',
        materials: expect.arrayContaining(['oil', 'canvas']),
        dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80, unit: 'cm' }),
      }),
      confirmedFacts: expect.objectContaining({
        category: 'paintings',
        dimensions: expect.objectContaining({ widthCm: 60, heightCm: 80, unit: 'cm' }),
      }),
      uncertainFacts: expect.arrayContaining([
        expect.objectContaining({ field: 'era' }),
      ]),
      revisionHistory: expect.arrayContaining([
        expect.objectContaining({ actor: 'seller' }),
      ]),
      sellerConfirmation: expect.objectContaining({
        required: true,
        status: 'partial',
      }),
      handoff: expect.objectContaining({
        to: expect.arrayContaining(['s3', 's4', 's5']),
        status: 'ready_for_review',
      }),
      safetyRules: expect.objectContaining({
        sellerConfirmsExtractedFacts: true,
        askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
        weakEvidenceNeverProducesInventedPrice: true,
        noHouseRecommendation: true,
        noValuation: true,
        noContactCapture: true,
      }),
    }));
  });

  // Test 8: Data safety - sensitive information (email, phone, URLs, credentials) is not present
  // This ensures compliance with privacy and security requirements for seller data handling
  it('does not leak sensitive data in logs or artifacts', () => {
    const service = new SellerIntakeService();
    const draft = service.createDraftSellerItem(fixture);

    const serialized = JSON.stringify(draft);
    const logSink = [
      JSON.stringify({ summary: 'seller intake preview', draft }),
      `draft preview: ${serialized}`,
    ].join('\n');

    expect(logSink).toContain('seller-item-draft-001');
    expect(logSink).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(logSink).not.toMatch(/\b(?:\+?\d[\d\s-]{7,}\d)\b/);
    expect(logSink).not.toMatch(/https?:\/\/[^\s]+/i);
    expect(logSink).not.toMatch(/verification|code|signed-url|credential/i);
    expect(logSink).not.toMatch(/full conversation|conversation transcript|chat transcript/i);
  });
});
