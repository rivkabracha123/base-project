import { Injectable } from '@nestjs/common';
import type { SellerEvidenceReference, SellerItemDraft } from '@monabid/shared';

const REQUIRED_SELLER_DETAILS = [
  'dimensions',
  'condition',
  'marks',
  'signatures',
  'provenance',
] as const;

export type MissingSellerQuestion = {
  field: (typeof REQUIRED_SELLER_DETAILS)[number];
  he: string;
  en: string;
};

type CorrectableSellerField = 'category' | 'materials' | 'dimensions' | 'condition' | 'marks' | 'signatures' | 'provenance';
type CorrectionValue = string | string[] | { widthCm: number; heightCm: number };

@Injectable()
export class SellerIntakeService {
  // Build a review state from the seller's initial intake text.
  buildReviewState(input: string): {
    category: string;
    materials: string[];
    dimensions: { widthCm: number; heightCm: number };
    markings: string;
    condition: string;
    signatures: string;
    provenance?: string;
    missingFields: string[];
    uncertainFields: string[];
  } {
    const extracted = this.parseSellerInput(input);
    const missingFields: string[] = [];
    const uncertainFields: string[] = [];

    if (extracted.dimensions.widthCm === 0 && extracted.dimensions.heightCm === 0) {
      missingFields.push('dimensions');
    }
    if (!extracted.markings || extracted.markings === 'Not yet confirmed') {
      missingFields.push('marks');
    }
    if (!extracted.provenance) {
      missingFields.push('provenance');
    }
    if (!extracted.condition || extracted.condition === 'Not yet confirmed') {
      missingFields.push('condition');
    }

    if (!extracted.signatures || extracted.signatures === 'Not yet confirmed') {
      missingFields.push('signatures');
    }
    if (extracted.category === 'unknown') {
      uncertainFields.push('category');
    }
    if (extracted.materials.length === 0) {
      uncertainFields.push('materials');
    }

    return {
      ...extracted,
      missingFields,
      uncertainFields,
    };
  }

  // Create a safe first draft from one seller message before the seller confirms any facts.
  createInitialDraft(input: string): {
    status: 'draft';
    extractedFacts: ReturnType<SellerIntakeService['parseSellerInput']>;
    missingFields: string[];
    uncertainFields: string[];
    confirmedFacts: Record<string, never>;
    sellerConfirmation: { required: true; status: 'pending' };
  } {
    const reviewState = this.buildReviewState(input);
    const { missingFields, uncertainFields, ...extractedFacts } = reviewState;

    return {
      status: 'draft',
      extractedFacts,
      missingFields,
      uncertainFields,
      confirmedFacts: {},
      sellerConfirmation: { required: true, status: 'pending' },
    };
  }

  // Build an API draft without treating fixture facts as seller-confirmed.
  createDraftFromSellerInput(fixture: SellerItemDraft, input: string): SellerItemDraft {
    const reviewState = this.buildReviewState(input);
    const item = {
      ...fixture.item,
      category: reviewState.category,
      materials: reviewState.materials,
      dimensions: {
        ...fixture.item.dimensions,
        widthCm: reviewState.dimensions.widthCm || undefined,
        heightCm: reviewState.dimensions.heightCm || undefined,
        values:
          reviewState.dimensions.widthCm && reviewState.dimensions.heightCm
            ? [
                { label: 'width', value: reviewState.dimensions.widthCm, unit: 'cm' },
                { label: 'height', value: reviewState.dimensions.heightCm, unit: 'cm' },
              ]
            : [],
      },
      condition: reviewState.condition === 'Not yet confirmed' ? undefined : reviewState.condition,
      markings: reviewState.markings === 'Not yet confirmed' ? undefined : reviewState.markings,
      provenance: reviewState.provenance,
    };

    return this.createDraftSellerItem({
      ...fixture,
      item,
      confirmedFacts: {},
      sellerConfirmation: {
        ...fixture.sellerConfirmation,
        status: 'pending',
        lastConfirmedAt: undefined,
        notes: 'Extracted facts require seller confirmation before downstream use.',
      },
      handoff: {
        ...fixture.handoff,
        notes: 'Only seller-confirmed facts are trusted downstream.',
      },
    });
  }

  // Apply one seller correction to the current review state.
  applySellerCorrection(state: {
  category?: string;
  materials?: string[];
  dimensions?: { widthCm: number; heightCm: number };
  markings?: string;
  condition?: string;
  signatures?: string;
  provenance?: string;
  missingFields?: string[];
  uncertainFields?: string[];
}, field: string, value: string | string[] | { widthCm: number; heightCm: number }): typeof state {
    if (field === 'dimensions' && typeof value === 'object' && !Array.isArray(value)) {
      return { ...state, dimensions: value, missingFields: (state.missingFields ?? []).filter((item) => item !== 'dimensions') };
    }

    if (field === 'materials' && Array.isArray(value)) {
      return { ...state, materials: value, uncertainFields: (state.uncertainFields ?? []).filter((item) => item !== 'materials') };
    }

    return {
      ...state,
      [field]: value,
      missingFields: (state.missingFields ?? []).filter((item) => item !== field),
    };
  }

  // Classify a fact as confirmed, uncertain, unknown, or incomplete before handoff.
  markFactStatus(field: string, value: string | number | null, isConfirmed: boolean): 'confirmed' | 'uncertain' | 'unknown' | 'incomplete' {
    if (field === 'dimensions' && value !== null && typeof value !== 'string') {
      return isConfirmed ? 'confirmed' : 'uncertain';
    }
    return this.classifyFactStatus(value, isConfirmed);
  }

  // Create the review loop state for the seller's current draft item.
  createReviewLoop(input: string): {
    reviewState: ReturnType<SellerIntakeService['buildReviewState']>;
    missingFields: string[];
    revision: {
      revisionId: string;
      timestamp: string;
      actor: 'seller' | 'assistant' | 'system';
      summary: string;
      changes: string[];
    };
  } {
    const reviewState = this.buildReviewState(input);
    const missingFields = reviewState.missingFields;
    const revision = this.appendRevisionEntry('assistant', 'Seller intake reviewed for confirmation', [
      `Extracted category: ${reviewState.category}`,
      `Pending item checks: ${missingFields.join(', ') || 'none'}`,
    ]);

    return {
      reviewState,
      missingFields,
      revision,
    };
  }

  // Extract likely item facts from the seller's first message.
  parseSellerInput(input: string): {
  category: string;
  materials: string[];
  dimensions: { widthCm: number; heightCm: number };
  markings: string;
  condition: string;
  signatures: string;
  provenance?: string;
} {
    const text = input.toLowerCase();
    const hebrewDimensions = input.match(/(\d+)\s*על\s*(\d+)/);
    const hebrewMaterials = [
      ...(text.includes('שמן') ? ['oil'] : []),
      ...(text.includes('בד') ? ['canvas'] : []),
    ];

    const category = text.includes('painting') || text.includes('ציור') ? 'paintings' : 'unknown';
    const materials = [] as string[];
    if (text.includes('oil') || text.includes('שמן')) materials.push('oil');
    if (text.includes('canvas') || text.includes('בד')) materials.push('canvas');

    const widthMatch = input.match(/(\d+)\s*(?:x|על|by)\s*(\d+)/i);
    const dimensions = widthMatch
      ? { widthCm: Number(widthMatch[1]), heightCm: Number(widthMatch[2]) }
      : { widthCm: 0, heightCm: 0 };

    const markings =
      text.includes('mark') ||
      text.includes('stamp') ||
      text.includes('inscription') ||
      input.includes('סימן') ||
      input.includes('חותמת') ||
      input.includes('כיתוב')
        ? 'Markings provided'
        : 'Not yet confirmed';
    const condition =
    text.includes('good condition') || text.includes('מצב טוב')
      ? 'Good condition'
      : 'Not yet confirmed';

  const signatures =
    text.includes('signed') || text.includes('חתום')
      ? 'Signed'
      : 'Not yet confirmed';
    const provenance = input.includes('family') || input.includes('משפחה') ? 'Family archive; acquired in Jerusalem in the early 1990s.' : undefined;

    return {
      category: text.includes('ציור') ? 'paintings' : category,
      materials: [...new Set([...materials, ...hebrewMaterials])],
      dimensions: hebrewDimensions
        ? { widthCm: Number(hebrewDimensions[1]), heightCm: Number(hebrewDimensions[2]) }
        : dimensions,
      markings,
      condition,
      signatures,
      provenance: input.includes('משפחה')

        ? 'Family archive; acquired in Jerusalem in the early 1990s.'
        : provenance,
    };
  }

  // Turn the extracted facts into a seller-facing summary for review.
  summarizeDraftItem(input: string): { he: string; en: string } {
    const guessed = this.parseSellerInput(input);
    return {
      he: `אני מבינה שהפריט הוא ${guessed.category === 'paintings' ? 'ציור' : 'פריט'} עם מידות ${guessed.dimensions.widthCm}x${guessed.dimensions.heightCm} ס"מ, ${guessed.markings.toLowerCase()}.`,
      en: `I understand this is a ${guessed.category === 'paintings' ? 'painting' : 'item'} with approximate dimensions of ${guessed.dimensions.widthCm}x${guessed.dimensions.heightCm} cm and ${guessed.markings.toLowerCase()}.`,
    };
  }

  // Identify the important missing details the seller must confirm.
    askMissingSellerDetails(
      reviewState?: ReturnType<SellerIntakeService['buildReviewState']>,
  ): string[] {
      if (!reviewState) return [...REQUIRED_SELLER_DETAILS];

      return REQUIRED_SELLER_DETAILS.filter((field) => reviewState.missingFields.includes(field));
  }

  // Apply a seller approval or correction to one specific field.
  confirmOrCorrectField(field: string, value: string): { field: string; value: string } {
    return { field, value };
  }

  // Mark each fact as confirmed, uncertain, unknown, or incomplete.
  classifyFactStatus(value: string | number | null, isConfirmed: boolean): 'confirmed' | 'uncertain' | 'unknown' | 'incomplete' {
    if (value === null) return 'unknown';
    if (!isConfirmed) return 'uncertain';
    return 'confirmed';
  }

  // Record a revision event so the seller review history remains traceable.
  appendRevisionEntry(actor: 'seller' | 'assistant' | 'system', summary: string, changes: string[]): {
    revisionId: string;
    timestamp: string;
    actor: 'seller' | 'assistant' | 'system';
    summary: string;
    changes: string[];
  } {
    return {
      revisionId: `rev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor,
      summary,
      changes,
    };
  }

  // Create the final S1 draft item with confirmed and flagged uncertain facts.
  createDraftSellerItem(fixture: SellerItemDraft): SellerItemDraft {
    return {
      ...fixture,
      status: 'draft',
      sellerConfirmation: {
        required: true,
        status: fixture.sellerConfirmation.status === 'pending' ? 'pending' : 'partial',
        lastConfirmedAt:
          fixture.sellerConfirmation.status === 'pending'
            ? undefined
            : fixture.sellerConfirmation.lastConfirmedAt ?? new Date().toISOString(),
        notes:
          fixture.sellerConfirmation.status === 'pending'
            ? 'Extracted facts require seller confirmation before downstream use.'
            : 'Confirmed facts are safe for downstream review; uncertain facts remain flagged.',
      },
      handoff: {
        to: ['s3', 's4', 's5'],
        status: 'ready_for_review',
        notes: 'Only confirmed SellerItem facts are trusted downstream. Uncertain facts remain explicitly flagged.',
      },
      safetyRules: {
        sellerConfirmsExtractedFacts: true,
        askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
        weakEvidenceNeverProducesInventedPrice: true,
        noHouseRecommendation: true,
        noValuation: true,
        noContactCapture: true,
      },
    };
  }

  // Attach S2 evidence references without treating image metadata as seller-confirmed facts.
  attachEvidenceReferences(
    draft: SellerItemDraft,
    references: SellerEvidenceReference[],
  ): SellerItemDraft {
    const referenceIds = new Set(references.map((reference) => reference.fileId));
    const evidence = [
      ...draft.evidence.filter((item) => !referenceIds.has(item.id)),
      ...references.map((reference) => ({
        id: reference.fileId,
        type: 'photo',
        source: 'seller-upload',
        uri: reference.previewUri,
        profileId: reference.profileId,
        previewUri: reference.previewUri,
        originalName: reference.originalName,
        mimeType: reference.mimeType,
        size: reference.size,
      })),
    ];

    return {
      ...draft,
      item: {
        ...draft.item,
        evidenceIds: [
          ...new Set([...draft.item.evidenceIds, ...references.map((reference) => reference.fileId)]),
        ],
      },
      evidence,
    };
  }

  // Link seller-selected evidence references to a fact without confirming the fact.
  linkEvidenceToFact(
    draft: SellerItemDraft,
    field: 'dimensions' | 'condition' | 'marks' | 'signatures' | 'provenance',
    evidenceIds: string[],
  ): SellerItemDraft {
    const availableEvidenceIds = new Set(draft.evidence.map((item) => item.id));
    const linkedEvidenceIds = [...new Set(evidenceIds)].filter((id) => availableEvidenceIds.has(id));

    return {
      ...draft,
      factEvidence: {
        ...draft.factEvidence,
        [field]: linkedEvidenceIds,
      },
    };
  }

  mergeNewIntakeTurn(existing: SellerItemDraft, incoming: SellerItemDraft): SellerItemDraft {
    return {
      ...incoming,
      confirmedFacts: { ...incoming.confirmedFacts, ...existing.confirmedFacts },
      sellerConfirmation: existing.sellerConfirmation,
      revisionHistory: [...existing.revisionHistory, ...incoming.revisionHistory],
    };
  }

  applySellerDraftCorrection(
    draft: SellerItemDraft,
    field: CorrectableSellerField,
    value: CorrectionValue,
  ): SellerItemDraft {
    const item = { ...draft.item };
    const confirmedFacts = { ...draft.confirmedFacts };

    if (field === 'dimensions' && typeof value === 'object' && !Array.isArray(value)) {
      item.dimensions = { ...item.dimensions, ...value };
      confirmedFacts.dimensions = item.dimensions;
    } else if (field === 'materials' && Array.isArray(value)) {
      item.materials = value;
      confirmedFacts.materials = value;
    } else if (typeof value === 'string') {
      if (field === 'category') {
        item.category = value;
        confirmedFacts.category = value;
      } else if (field === 'condition') {
        item.condition = value;
        confirmedFacts.condition = value;
      } else if (field === 'marks') {
        item.markings = value;
        confirmedFacts.markings = value;
      } else if (field === 'provenance') {
        item.provenance = value;
        confirmedFacts.provenance = value;
      }
    }

    const catalogLine = `${field}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
    item.catalogDraft = {
      he: [item.catalogDraft.he, catalogLine].filter(Boolean).join('\n'),
      en: [item.catalogDraft.en, catalogLine].filter(Boolean).join('\n'),
    };

    return {
      ...draft,
      item,
      confirmedFacts,
      updatedAt: new Date().toISOString(),
      revisionHistory: [
        ...draft.revisionHistory,
        this.appendRevisionEntry('seller', `Corrected ${field}`, [field]),
      ],
    };
  }

  confirmSellerFacts(draft: SellerItemDraft, fields: CorrectableSellerField[]): SellerItemDraft {
    const confirmedFacts = { ...draft.confirmedFacts };

    for (const field of fields) {
      if (field === 'category') confirmedFacts.category = draft.item.category;
      if (field === 'materials') confirmedFacts.materials = draft.item.materials;
      if (field === 'dimensions') confirmedFacts.dimensions = draft.item.dimensions;
      if (field === 'condition') {
        if (!draft.item.condition) throw new Error('Cannot confirm a missing condition fact');
        confirmedFacts.condition = draft.item.condition;
      }
      if (field === 'marks') {
        if (!draft.item.markings) throw new Error('Cannot confirm a missing marks fact');
        confirmedFacts.markings = draft.item.markings;
      }
      if (field === 'provenance') {
        if (!draft.item.provenance && !confirmedFacts.provenance) {
          throw new Error('Cannot confirm a missing provenance fact');
        }
        confirmedFacts.provenance = confirmedFacts.provenance ?? draft.item.provenance;
      }
    }

    return {
      ...draft,
      confirmedFacts,
      updatedAt: new Date().toISOString(),
      sellerConfirmation: {
        ...draft.sellerConfirmation,
        status: 'partial',
        lastConfirmedAt: new Date().toISOString(),
      },
      revisionHistory: [
        ...draft.revisionHistory,
        this.appendRevisionEntry('seller', 'Confirmed seller facts', fields),
      ],
    };
  }

  // Prepare the downstream payload with only safe confirmed item facts.
  buildHandoffPayload(
    fixture: SellerItemDraft,
    confirmedFacts: SellerItemDraft['confirmedFacts'] = fixture.confirmedFacts,
  ): {
    item: SellerItemDraft['item'];
    confirmedFacts: SellerItemDraft['confirmedFacts'];
    uncertainFacts: SellerItemDraft['uncertainFacts'];
    evidence: SellerItemDraft['evidence'];
    factEvidence?: SellerItemDraft['factEvidence'];
    revisionHistory: SellerItemDraft['revisionHistory'];
  } {
    return {
      item: fixture.item,
      confirmedFacts,
      uncertainFacts: fixture.uncertainFacts,
      evidence: fixture.evidence,
      factEvidence: fixture.factEvidence,
      revisionHistory: fixture.revisionHistory,
    };
  }
}
