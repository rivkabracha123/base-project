// Tests for SellerIntakeService covering seller fact extraction,
// draft creation, missing and uncertain information,
// seller corrections and confirmations, safe handoff,
// and the Week 3 seller conversation requirements.
import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeAiMock } from './seller-intake-ai.mock';
import { SellerIntakeService } from './seller-intake.service';

const aiDimensions = [
  { label: 'width', value: 60, unit: 'cm' },
  { label: 'height', value: 80, unit: 'cm' },
];

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
    expect(result.dimensions).toEqual({ widthCm: 0, heightCm: 0 });
    expect(result.markings).toBe('Not yet confirmed');
    expect(result.provenance).toBeUndefined();

    expect(result.materials).not.toContain('oil');
    expect(result.materials).not.toContain('canvas');
    expect(result.materials).not.toContain('metal');
  });

  it('classifies a Hebrew printed book as rare_books for S3 matching', () => {
    const result = service.parseSellerInput(
      'I have a rare Hebrew book, a printed sefer from the family archive.',
    );
    expect(result.category).toBe('rare_books');
  });

  it('creates an initial bilingual draft from Hebrew seller input', () => {
    const result = service.createInitialDraft(
      'יש לי ציור בגודל 60 על 80 ס"מ, חתום בפינה הימנית התחתונה.'
    );

    expect(result.status).toBe('draft');

    expect(result.extractedFacts.category).toBe('paintings');

    expect(result.extractedFacts.dimensions).toEqual({ widthCm: 0, heightCm: 0 });

    expect(result.extractedFacts.markings).toBe('Not yet confirmed');

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

  it('creates a deterministic AI mock draft without reading an external JSON fixture', () => {
    const aiMock = new SellerIntakeAiMock(service);
    const result = aiMock.analyze('I have a painting, 60 x 80 cm, signed.');

    expect(result.provider).toBe('fixture-mock');
    expect(result.status).toBe('draft');
    expect(result.handoff.to).toEqual(['s3', 's4', 's5']);
    expect(result.missingFields).toEqual(['dimensions', 'condition', 'marks', 'provenance']);
  });

  it('keeps a session and rejects an answer that does not match the current question', () => {
    const aiMock = new SellerIntakeAiMock(service);

    const first = aiMock.analyze('I have a painting.', 'session-w5');
    expect(first.nextQuestion?.field).toBe('dimensions');

    const invalid = aiMock.analyze('It is in good condition.', 'session-w5');
    expect(invalid.answerAccepted).toBe(false);
    expect(invalid.answerError).toContain('dimensions');
    expect(invalid.nextQuestion?.field).toBe('dimensions');

    const accepted = aiMock.analyze('האורך 80 ס"מ והרוחב 60 ס"מ', 'session-w5');
    expect(accepted.answerAccepted).toBe(true);
    const enriched = aiMock.applyAiDimensions(accepted, [
      { label: 'length', value: 80, unit: 'cm' },
      { label: 'width', value: 60, unit: 'cm' },
    ]);
    expect(enriched.item.dimensions.values).toEqual([
      { label: 'length', value: 80, unit: 'cm' },
      { label: 'width', value: 60, unit: 'cm' },
    ]);
    expect(enriched.nextQuestion?.field).toBe('condition');
  });

  it('separates missing and uncertain information', () => {
    const reviewState = service.buildReviewState(
      'I have a painting. It is 60 x 80 cm and signed. I think it was made in the 1980s.',
      true,
    );

    expect(reviewState.category).toBe('paintings');

    expect(reviewState.dimensions).toEqual({
      widthCm: 0,
      heightCm: 0,
    });

    expect(reviewState.missingFields).toContain('provenance');

    expect(reviewState.uncertainFields).toContain('materials');

    expect(reviewState.uncertainFields).not.toContain('category');
  });


    it('identifies missing seller details and recognizes provided details', () => {
      // Check that condition and signatures are detected as missing.
      const missingDetails = service.buildReviewState(
        'I have a painting, 60 x 80 cm.',
        true,
      );

      expect(missingDetails.missingFields).toContain('condition');
      expect(missingDetails.missingFields).toContain('signatures');

      // Check that provided condition and signatures are not marked as missing.
      const providedDetails = service.buildReviewState(
        'I have a painting, 60 x 80 cm, good condition, signed.',
        true,
      );

      expect(providedDetails.missingFields).not.toContain('condition');
      expect(providedDetails.missingFields).not.toContain('signatures');
    });

  it('identifies all five required details when the seller omits them', () => {
  const reviewState = service.buildReviewState('I have a painting.');

  const result = service.askMissingSellerDetails(reviewState);

  expect(result).toEqual([
    'dimensions',
    'condition',
    'marks',
    'signatures',
    'provenance',
  ]);
});

  it('keeps marks missing when the seller only reports a signature', () => {
    const reviewState = service.buildReviewState(
      'I have a painting, 60 x 80 cm, signed.',
      true,
    );

    expect(reviewState.signatures).toBe('Signed');
    expect(reviewState.markings).toBe('Not yet confirmed');
    expect(reviewState.missingFields).toContain('marks');
    expect(reviewState.missingFields).not.toContain('signatures');
  });

  it('asks only for required details missing from the seller message', () => {
    const reviewState = service.buildReviewState(
      'I have a painting, 60 x 80 cm, good condition, signed.',
      true,
    );

    expect(service.askMissingSellerDetails(reviewState)).toEqual(['marks', 'provenance']);
  });

  it('creates bilingual questions only for missing seller details', () => {
    const reviewState = service.buildReviewState(
      'I have a painting, 60 x 80 cm, good condition, signed.',
      true,
    );

    expect(service.askMissingSellerQuestions(reviewState)).toEqual([
      {
        field: 'marks',
        he: 'יש סימונים, חותמות או כיתוב שכדאי לציין?',
        en: 'Any marks, stamps, or inscriptions worth noting?',
      },
      {
        field: 'provenance',
        he: 'ידוע לך משהו על המקור או ההיסטוריה של הפריט?',
        en: "Do you know anything about the item's origin or history?",
      },
    ]);
  });

  it('returns only the next missing question for sequential seller answers', () => {
    const reviewState = service.buildReviewState('I have a painting.');

    expect(service.askNextSellerQuestion(reviewState)).toEqual({
      field: 'dimensions',
      he: 'מה המידות? למשל 80×70 ס״מ.',
      en: 'What are the dimensions? For example, 80 × 70 cm.',
    });
  });

 // Week 3: Verify that seller corrections update the review state
  // and that only explicitly confirmed facts become confirmed.
it('updates seller corrections and fact confirmation status', () => {
  const reviewState = service.buildReviewState(
    'I have a painting. It is 60 x 80 cm and signed.'
  );

  const correctedState = service.applySellerCorrection(
    reviewState,
    'provenance',
    'Family archive'
  );

  expect(correctedState.provenance).toBe('Family archive');
  expect(correctedState.missingFields).not.toContain('provenance');

  expect(
    service.markFactStatus('provenance', 'Family archive', true)
  ).toBe('confirmed');

  expect(
    service.markFactStatus('materials', 'oil', false)
  ).toBe('uncertain');

  expect(
    service.markFactStatus('condition', null, false)
  ).toBe('unknown');
});

  it('passes a seller correction into the downstream handoff', () => {
    const reviewState = service.buildReviewState(
      'I have a painting, 60 x 80 cm, signed.',
    );
    const correctedState = service.applySellerCorrection(
      reviewState,
      'provenance',
      'Family archive',
    );
    const handoff = service.buildHandoffPayload(fixture, {
      ...fixture.confirmedFacts,
      provenance: correctedState.provenance,
    });

    expect(handoff.confirmedFacts.provenance).toBe('Family archive');
    expect(handoff.confirmedFacts).toEqual(
      expect.objectContaining({ provenance: 'Family archive' }),
    );
  });

  it('persists a seller-approved correction, updates the catalog draft, and requests recalculation', () => {
    const draft = service.createDraftFromSellerInput(
      fixture,
      'I have a painting, 60 x 80 cm, signed.',
      aiDimensions,
    );

    const correctedDraft = service.applySellerDraftCorrection(
      draft,
      'provenance',
      'Family archive',
    );

    expect(correctedDraft.confirmedFacts.provenance).toBe('Family archive');
    expect(correctedDraft.item.provenance).toBe('Family archive');
    expect(correctedDraft.item.catalogDraft.en).toContain('provenance: Family archive');
    expect(correctedDraft.missingFields).not.toContain('provenance');
    expect(correctedDraft.recalculationRequired).toBe(true);
    expect(correctedDraft.revisionHistory.at(-1)).toEqual(
      expect.objectContaining({
        actor: 'seller',
        changes: ['provenance'],
      }),
    );
    expect(correctedDraft.sellerConfirmation.status).toBe('partial');
  });

  it('does not expose fixture facts as confirmed before seller approval', () => {
    const draft = service.createDraftFromSellerInput(
      fixture,
      'I have a painting, 60 x 80 cm, signed.',
      aiDimensions,
    );

    expect(draft.item.title).toBe('Painting width 60 cm, height 80 cm');
    expect(draft.item.catalogDraft.en).toContain('paintings');
    expect(draft.item.catalogDraft.en).toContain('width 60 cm, height 80 cm');
    expect(draft.confirmedFacts).toEqual({});
    expect(draft.item.provenance).toBeUndefined();
    expect(draft.item.condition).toBeUndefined();
    expect(draft.sellerConfirmation.status).toBe('pending');
  });

  it('changes the draft title and catalog when the seller message changes', () => {
    const painting = service.createDraftFromSellerInput(fixture, 'I have a painting, 40 x 50 cm, signed.', [
      { label: 'width', value: 40, unit: 'cm' },
      { label: 'height', value: 50, unit: 'cm' },
    ]);
    const other = service.createDraftFromSellerInput(fixture, 'Bronze figurine from a family archive.');

    expect(painting.item.title).toBe('Painting width 40 cm, height 50 cm');
    expect(other.item.title).toContain('Bronze figurine');
    expect(painting.item.catalogDraft.en).not.toBe(other.item.catalogDraft.en);
  });

  it('uses a buyer-facing Hebrew title for a manuscript draft instead of an internal English label', () => {
    const draft = service.createDraftFromSellerInput(fixture, 'יש לי כתב יד עתיק', [
      { label: 'width', value: 80, unit: 'cm' },
      { label: 'height', value: 70, unit: 'cm' },
    ]);

    expect(draft.item.title).toBe('כתב יד או ספר נדיר');
    expect(draft.item.title).not.toContain('seller intake');
  });

  it('confirms only requested available facts and keeps unconfirmed catalog fields explicit', () => {
    const draft = service.createDraftFromSellerInput(
      fixture,
      'I have a painting, 60 x 80 cm, signed.',
      aiDimensions,
    );

    const confirmed = service.confirmSellerFacts(draft, ['category', 'dimensions']);

    expect(confirmed.confirmedFacts.category).toBe('paintings');
    expect(confirmed.confirmedFacts.dimensions?.values).toEqual(aiDimensions);
    expect(confirmed.confirmedFacts.condition).toBeUndefined();
    expect(confirmed.recalculationRequired).toBe(true);
    expect(confirmed.revisionHistory.at(-1)).toEqual(expect.objectContaining({
      actor: 'seller',
      changes: ['category', 'dimensions'],
    }));
    expect(confirmed.item.catalogDraft.en).toContain('condition not confirmed');
    expect(confirmed.item.catalogDraft.en).toContain('signature not confirmed');
    expect(confirmed.sellerConfirmation.status).toBe('partial');
  });

  it('marks the seller confirmation complete only after every required fact is confirmed', () => {
    let draft = service.createDraftFromSellerInput(
      fixture,
      'I have a painting, 60 x 80 cm, good condition, marked, signed, from a family archive.',
      aiDimensions,
    );
    draft = service.confirmSellerFacts(draft, ['dimensions', 'condition', 'marks', 'signatures', 'provenance']);

    expect(draft.sellerConfirmation.status).toBe('complete');
    expect(draft.confirmedFacts).toEqual(expect.objectContaining({
      dimensions: expect.any(Object),
      condition: expect.any(String),
      markings: expect.any(String),
      signatures: expect.any(String),
      provenance: expect.any(String),
    }));
  });

  it('preserves a seller correction and revision history when another intake turn arrives', () => {
    const initial = service.createDraftFromSellerInput(fixture, 'I have a painting.');
    const corrected = service.applySellerDraftCorrection(initial, 'provenance', 'Family archive');
    const nextTurn = service.createDraftFromSellerInput(fixture, 'It is in good condition.');

    const merged = service.mergeNewIntakeTurn(corrected, nextTurn);

    expect(merged.confirmedFacts.provenance).toBe('Family archive');
    expect(merged.item.provenance).toBe('Family archive');
    expect(merged.revisionHistory).toEqual(corrected.revisionHistory);
    expect(merged.recalculationRequired).toBe(true);
    expect(merged.item.catalogDraft.en).toContain('provenance: Family archive');
  });

  it('keeps a written description when another intake turn arrives', () => {
    const initial = service.createDraftFromSellerInput(fixture, 'I have a painting.');
    const described = service.applySellerDraftCorrection(initial, 'description', { he: 'ציור שמן על בד, במצב טוב.' });
    const nextTurn = service.createDraftFromSellerInput(fixture, 'It is signed.');

    const merged = service.mergeNewIntakeTurn(described, nextTurn);

    expect(merged.item.description.he).toBe('ציור שמן על בד, במצב טוב.');
  });

  it('does not ask again for a fact already corrected and confirmed in an earlier turn', () => {
    const initial = service.createDraftFromSellerInput(fixture, 'I have a painting.');
    const corrected = service.applySellerDraftCorrection(initial, 'provenance', 'Family archive');
    const nextTurn = service.createDraftFromSellerInput(fixture, 'It is in good condition.');

    const merged = service.mergeNewIntakeTurn(corrected, nextTurn);

    expect(merged.missingFields).not.toContain('provenance');
    expect(merged.uncertainFacts.some((fact) => fact.field === 'provenance')).toBe(false);
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

expect(draft.language).toEqual({
  preferred: 'he',
  secondary: 'en',
  conversationMode: 'bilingual',
});
    expect(draft.seller).toEqual({
  name: 'Maya Cohen',
  anonymousProfileId: 'profile-demo-001',
  preferredName: 'Maya',
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

    // expect(draft.uncertainFacts).toEqual({
    //   era: {
    //     value: '1980s',
    //     status: 'uncertain',
    //   },
    // });

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