import { SellerIntakeController } from './seller-intake.controller';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeService } from './seller-intake.service';
import type { SellerItemDraft } from '@monabid/shared';

describe('SellerIntakeService', () => {
  // Deterministic test data kept directly in the test file.
  // This avoids depending on an external JSON fixture file.
  const fixture = {
    id: 'seller-item-draft-001',
    feature: 'seller-conversation',
    developer: 's1',
    week: 2,
    status: 'draft',

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
      materials: ['oil', 'canvas'],
      dimensions: {
        widthCm: 60,
        heightCm: 80,
        unit: 'cm',
      },
      source: 'seller-intake',
    },

    confirmedFacts: {
      category: 'paintings',
      dimensions: {
        widthCm: 60,
        heightCm: 80,
        unit: 'cm',
      },
    },

    uncertainFacts: [
      {
        field: 'era',
        value: '1980s',
        status: 'uncertain',
      },
      {
        field: 'materials',
        value: 'oil, canvas',
        status: 'uncertain',
      },
    ],

    evidence: [
      {
        source: 'seller-intake',
        text: 'Seller stated that the item is a painting measuring 60 x 80 cm.',
      },
    ],

    revisionHistory: [
      {
        revisionId: 'rev-001',
        timestamp: '2026-01-01T00:00:00.000Z',
        actor: 'seller',
        summary: 'Initial seller intake',
        changes: ['Created initial draft'],
      },
    ],

    sellerConfirmation: {
      required: true,
      status: 'partial',
      lastConfirmedAt: undefined,
      notes: 'Initial seller confirmation is partial.',
    },

    handoff: {
      to: ['s3', 's4', 's5'],
      status: 'ready_for_review',
      notes: 'Ready for downstream review.',
    },

    safetyRules: {
      sellerConfirmsExtractedFacts: true,
      askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
      weakEvidenceNeverProducesInventedPrice: true,
      noHouseRecommendation: true,
      noValuation: true,
      noContactCapture: true,
    },
  } as SellerItemDraft;

  // Test 1: Input parsing enforces fact extraction without invention
  it('extracts only facts explicitly present in seller input', () => {
    const service = new SellerIntakeService();

    const input =
      'I have an item that is 40 x 30 cm, signed, and described as wooden. I am not sure about the maker.';

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

  // Test 2: Initial draft marks extracted data as unconfirmed
  it('creates an unconfirmed initial draft from seller input', () => {
    const service = new SellerIntakeService();

    const draft = service.createInitialDraft(
      'יש לי ציור בגודל 60 על 80 ס"מ, והוא חתום.',
    );

    expect(draft.status).toBe('draft');
    expect(draft.extractedFacts.category).toBe('paintings');
    expect(draft.extractedFacts.dimensions).toEqual({
      widthCm: 60,
      heightCm: 80,
    });
    expect(draft.extractedFacts.markings).toBe('Signed lower right');

    expect(draft.confirmedFacts).toEqual({});
    expect(draft.sellerConfirmation).toEqual({
      required: true,
      status: 'pending',
    });

    expect(draft.missingFields).toContain('provenance');
  });

  // Test 3: Deterministic draft data can be processed without an external JSON file
  it('creates a deterministic SellerItemDraft from local test data', () => {
    const service = new SellerIntakeService();

    const draft = service.createDraftSellerItem(fixture);

    expect(draft.provider).toBeUndefined();
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
      dimensions: expect.objectContaining({
        widthCm: 60,
        heightCm: 80,
      }),
    });
  });

  // Test 4: Confirmed and uncertain facts are tracked separately
  it('keeps uncertain or missing information separate from the trusted draft', () => {
    const service = new SellerIntakeService();

    const input =
      'I have a painting. It is 60 x 80 cm and signed. I think it was made in the 1980s.';

    const reviewState = service.buildReviewState(input);
    const draft = service.createDraftSellerItem(fixture);

    expect(reviewState.missingFields).toContain('provenance');
    expect(reviewState.uncertainFields).toContain('materials');
    expect(reviewState.uncertainFields).not.toContain('category');

    expect(draft.confirmedFacts).toEqual(
      expect.objectContaining({
        category: 'paintings',
        dimensions: expect.objectContaining({
          widthCm: 60,
          heightCm: 80,
        }),
      }),
    );

    expect(
      draft.uncertainFacts.some(
        (fact: { field: string }) => fact.field === 'era',
      ),
    ).toBe(true);
  });

  // Test 5: Controller can be constructed with the mock provider
  // without loading an external JSON fixture from this test file.
  it('accepts seller intake through the controller', () => {
    const service = new SellerIntakeService();
    const controller = new SellerIntakeController(
      new SellerIntakeAiMock(service),
    );

    expect(controller).toBeDefined();
    expect(typeof controller.createDraft).toBe('function');
  });

  // Test 6: Draft item is properly structured and handoff metadata is ready
  it('creates a draft item and prepares a safe handoff', () => {
    const service = new SellerIntakeService();

    const draft = service.createDraftSellerItem(fixture);

    expect(draft.item).toEqual(
      expect.objectContaining({
        category: 'paintings',
        materials: expect.arrayContaining(['oil', 'canvas']),
        dimensions: expect.objectContaining({
          widthCm: 60,
          heightCm: 80,
        }),
      }),
    );

    expect(draft.handoff.to).toEqual(
      expect.arrayContaining(['s3', 's4', 's5']),
    );

    expect(draft.safetyRules).toMatchObject({
      sellerConfirmsExtractedFacts: true,
      askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
      weakEvidenceNeverProducesInventedPrice: true,
      noValuation: true,
      noHouseRecommendation: true,
      noContactCapture: true,
    });
  });

  // Test 7: Full SellerItemDraft contract
  it('returns a SellerItemDraft contract fit for downstream handoff', () => {
    const service = new SellerIntakeService();

    const draft = service.createDraftSellerItem(fixture);

    expect(draft).toEqual(
      expect.objectContaining({
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
          dimensions: expect.objectContaining({
            widthCm: 60,
            heightCm: 80,
            unit: 'cm',
          }),
        }),

        confirmedFacts: expect.objectContaining({
          category: 'paintings',
          dimensions: expect.objectContaining({
            widthCm: 60,
            heightCm: 80,
            unit: 'cm',
          }),
        }),

        uncertainFacts: expect.arrayContaining([
          expect.objectContaining({
            field: 'era',
          }),
        ]),

        revisionHistory: expect.arrayContaining([
          expect.objectContaining({
            actor: 'seller',
          }),
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
      }),
    );
  });

  // Test 8: Sensitive information is not leaked
  it('does not leak sensitive data in logs or artifacts', () => {
    const service = new SellerIntakeService();

    const draft = service.createDraftSellerItem(fixture);

    const serialized = JSON.stringify(draft);

    const logSink = [
      JSON.stringify({
        summary: 'seller intake preview',
        draft,
      }),
      `draft preview: ${serialized}`,
    ].join('\n');

    expect(logSink).toContain('seller-item-draft-001');

    expect(logSink).not.toMatch(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    );

    expect(logSink).not.toMatch(
      /\b(?:\+?\d[\d\s-]{7,}\d)\b/,
    );

    expect(logSink).not.toMatch(/https?:\/\/[^\s]+/i);

    expect(logSink).not.toMatch(
      /verification|code|signed-url|credential/i,
    );

    expect(logSink).not.toMatch(
      /full conversation|conversation transcript|chat transcript/i,
    );
  });
});