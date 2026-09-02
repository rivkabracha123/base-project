import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeService } from './seller-intake.service';

describe('SellerIntakeService', () => {
  let service: SellerIntakeService;

  const fixture = {
    id: 'seller-item-draft-001',
    feature: 'seller-conversation',
    developer: 's1',
    week: 2,
    status: 'draft',

    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',

    conversation: {} as SellerItemDraft['conversation'],

    language: {
  preferred: 'he',
  secondary: 'en',
  conversationMode: 'bilingual',
},

   seller: {
  name: 'Maya Cohen',
  anonymousProfileId: 'profile-demo-001',
  preferredName: 'Maya',
},

    item: {
  id: 'item-001',
  source: 'seller-intake',
  title: 'Abstract landscape study',
  description: {
    en: 'Abstract landscape study',
    he: 'מחקר נוף מופשט',
  },
  category: 'paintings',
  materials: ['oil', 'canvas'],
  dimensions: {
    values: [
      {
        label: 'width',
        value: 60,
        unit: 'cm',
      },
      {
        label: 'height',
        value: 80,
        unit: 'cm',
      },
    ],
    widthCm: 60,
    heightCm: 80,
    unit: 'cm',
  },

  evidenceIds: ['evidence-001'],

  catalogDraft: {
  en: 'Abstract landscape study',
  he: 'מחקר נוף מופשט',
},
},

    confirmedFacts: {
      category: 'paintings',
      dimensions: {
        values: [
          {
            label: 'width',
            value: 60,
            unit: 'cm',
          },
          {
            label: 'height',
            value: 80,
            unit: 'cm',
          },
        ],
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
    reason: 'Seller provided the era as uncertain information.',
  },
],

    evidence: [
      {
        type: 'seller_statement',
        id: 'evidence-001',
        source: 'seller',
        value: 'painting',
        confidence: 'high',
      },
    ],

    revisionHistory: [
      {
        revisionId: 'rev-001',
        timestamp: '2026-09-01T10:00:00.000Z',
        actor: 'seller',
        summary: 'Seller provided initial item facts',
        changes: ['category', 'dimensions'],
      },
    ],

    sellerConfirmation: {
      required: true,
      status: 'partial',
      lastConfirmedAt: '2026-09-01T10:00:00.000Z',
      notes: 'Seller confirmed the available facts.',
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

  beforeEach(() => {
    service = new SellerIntakeService();
  });

  it('parses English seller input without inventing facts', () => {
    const result = service.parseSellerInput(
      'I have a painting. It is 40 x 30 cm and signed.'
    );

    expect(result.category).toBe('paintings');
    expect(result.dimensions).toEqual({
      widthCm: 40,
      heightCm: 30,
    });
    expect(result.markings).toBe('Signed lower right');
    expect(result.provenance).toBeUndefined();

    expect(result.materials).not.toContain('oil');
    expect(result.materials).not.toContain('canvas');
    expect(result.materials).not.toContain('metal');
  });

  it('creates an initial bilingual draft from Hebrew seller input', () => {
    const result = service.createInitialDraft(
      'יש לי ציור בגודל 60 על 80 ס"מ, חתום בפינה הימנית התחתונה.'
    );

    expect(result.status).toBe('draft');

    expect(result.extractedFacts.category).toBe('paintings');

    expect(result.extractedFacts.dimensions).toEqual({
      widthCm: 60,
      heightCm: 80,
    });

    expect(result.extractedFacts.markings).toBe('Signed lower right');

    expect(result.confirmedFacts).toEqual({});

    expect(result.sellerConfirmation).toEqual({
      required: true,
      status: 'pending',
    });

    expect(result.missingFields).toContain('provenance');
  });

  it('creates a deterministic draft without external fixtures', () => {
    const draft = service.createDraftSellerItem(fixture);

    expect(draft.id).toBe('seller-item-draft-001');
    expect(draft.status).toBe('draft');

    expect(draft.item.category).toBe('paintings');

    expect(draft.item.dimensions?.values).toEqual([
      {
        label: 'width',
        value: 60,
        unit: 'cm',
      },
      {
        label: 'height',
        value: 80,
        unit: 'cm',
      },
    ]);

    expect(draft.confirmedFacts.category).toBe('paintings');
  });

  it('separates missing and uncertain information', () => {
    const reviewState = service.buildReviewState(
      'I have a painting. It is 60 x 80 cm and signed. I think it was made in the 1980s.'
    );

    expect(reviewState.category).toBe('paintings');

    expect(reviewState.dimensions).toEqual({
      widthCm: 60,
      heightCm: 80,
    });

    expect(reviewState.missingFields).toContain('provenance');

    expect(reviewState.uncertainFields).toContain('materials');

    expect(reviewState.uncertainFields).not.toContain('category');
  });

  it('builds a safe handoff payload', () => {
    const draft = service.createDraftSellerItem(fixture);

    const handoff = service.buildHandoffPayload(draft);

    expect(handoff.item).toEqual(draft.item);
    expect(handoff.confirmedFacts).toEqual(draft.confirmedFacts);
    expect(handoff.uncertainFacts).toEqual(draft.uncertainFacts);
    expect(handoff.evidence).toEqual(draft.evidence);
    expect(handoff.revisionHistory).toEqual(draft.revisionHistory);
  });

  it('creates a draft item with the required handoff and safety rules', () => {
    const draft = service.createDraftSellerItem(fixture);

    expect(draft.item.materials).toEqual(['oil', 'canvas']);

    expect(draft.item.dimensions?.values).toEqual([
      {
        label: 'width',
        value: 60,
        unit: 'cm',
      },
      {
        label: 'height',
        value: 80,
        unit: 'cm',
      },
    ]);

    expect(draft.handoff).toEqual({
      to: ['s3', 's4', 's5'],
      status: 'ready_for_review',
      notes:
        'Only confirmed SellerItem facts are trusted downstream. Uncertain facts remain explicitly flagged.',
    });

    expect(draft.safetyRules).toEqual({
      sellerConfirmsExtractedFacts: true,
      askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
      weakEvidenceNeverProducesInventedPrice: true,
      noHouseRecommendation: true,
      noValuation: true,
      noContactCapture: true,
    });
  });

  it('matches the SellerItemDraft contract', () => {
    const draft = service.createDraftSellerItem(fixture);

    expect(draft.id).toBeDefined();
    expect(draft.feature).toBe('seller-conversation');
    expect(draft.developer).toBe('s1');
    expect(draft.week).toBe(2);

    expect(draft.status).toBe('draft');

    expect(draft.createdAt).toBeDefined();
    expect(draft.updatedAt).toBeDefined();
    expect(draft.conversation).toBeDefined();

    expect(draft.language).toBe('bilingual');

    expect(draft.seller).toEqual({
      id: 'profile-demo-001',
      name: 'Maya Cohen',
      displayName: 'Maya',
    });

    expect(draft.item.category).toBe('paintings');
    expect(draft.item.materials).toEqual(['oil', 'canvas']);

    expect(draft.item.dimensions).toEqual({
      values: [
        {
          label: 'width',
          value: 60,
          unit: 'cm',
        },
        {
          label: 'height',
          value: 80,
          unit: 'cm',
        },
      ],
      widthCm: 60,
      heightCm: 80,
      unit: 'cm',
    });

    expect(draft.confirmedFacts).toEqual(fixture.confirmedFacts);

    expect(draft.uncertainFacts).toEqual({
      era: {
        value: '1980s',
        status: 'uncertain',
      },
    });

    expect(draft.revisionHistory).toHaveLength(1);
    expect(draft.revisionHistory[0]?.actor).toBe('seller');
    expect(draft.sellerConfirmation.required).toBe(true);
    expect(draft.sellerConfirmation.status).toBe('partial');

    expect(draft.handoff.to).toEqual(['s3', 's4', 's5']);
    expect(draft.handoff.status).toBe('ready_for_review');

    expect(draft.safetyRules.sellerConfirmsExtractedFacts).toBe(true);
    expect(
      draft.safetyRules
        .askForMissingDimensionsConditionMarksSignaturesAndProvenance
    ).toBe(true);
    expect(
      draft.safetyRules.weakEvidenceNeverProducesInventedPrice
    ).toBe(true);
  });

  it('does not include sensitive contact information or conversation transcripts', () => {
    const draft = service.createDraftSellerItem(fixture);

    const serialized = JSON.stringify(draft);

    expect(serialized).not.toMatch(/phone/i);
    expect(serialized).not.toMatch(/email/i);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/credentials/i);

    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('http://');
  });
});