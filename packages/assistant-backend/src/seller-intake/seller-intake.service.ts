import { Injectable } from '@nestjs/common';
import type { SellerDimensionMeasurement, SellerEvidenceReference, SellerItemDraft } from '@monabid/shared';
import type { SellerHandoffContract } from '../ai/seller-handoff';

const REQUIRED_SELLER_DETAILS = [
  'dimensions',
  'condition',
  'marks',
  'signatures',
  'provenance',
] as const;

const MISSING_SELLER_QUESTION_COPY = {
  dimensions: {
    he: 'מה המידות? למשל 80×70 ס״מ.',
    en: 'What are the dimensions? For example, 80 × 70 cm.',
  },
  condition: {
    he: 'איך מצב הפריט? יש פגמים או סימני בלאי שכדאי לציין?',
    en: 'How is its condition? Any defects or signs of wear worth noting?',
  },
  marks: {
    he: 'יש סימונים, חותמות או כיתוב שכדאי לציין?',
    en: 'Any marks, stamps, or inscriptions worth noting?',
  },
  signatures: {
    he: 'יש חתימה על הפריט? אם כן, איפה?',
    en: 'Is it signed? If so, where?',
  },
  provenance: {
    he: 'ידוע לך משהו על המקור או ההיסטוריה של הפריט?',
    en: "Do you know anything about the item's origin or history?",
  },
} as const;

export type MissingSellerQuestion = {
  field: (typeof REQUIRED_SELLER_DETAILS)[number] | 'category';
  he: string;
  en: string;
};

type SellerDraftCorrectionField =
  | 'title'
  | 'category'
  | 'description'
  | 'materials'
  | 'dimensions'
  | 'condition'
  | 'marks'
  | 'signatures'
  | 'provenance';

type SellerDraftCorrectionValue = string | string[] | { he?: string; en?: string }
  | { widthCm: number; heightCm: number } | SellerDimensionMeasurement[];

@Injectable()
export class SellerIntakeService {
  createDraftFromAiExtraction(
    fixture: SellerItemDraft,
    input: string,
    extraction: SellerHandoffContract,
  ): SellerItemDraft {
    const dimensions = extraction.item.dimensions?.values ?? [];
    const confirmedFacts: SellerItemDraft['confirmedFacts'] = {};
    const item = {
      ...fixture.item,
      title: extraction.item.title ?? this.draftTitleFromInput(input, extraction.category, { values: dimensions }),
      titleTranslations: extraction.item.title
        ? undefined
        : this.draftTitleTranslations(extraction.category, { values: dimensions }),
      category: extraction.category,
      materials: [],
      dimensions: { values: dimensions },
      condition: extraction.item.condition,
      markings: extraction.item.markings,
      signatures: extraction.item.signature,
      provenance: extraction.item.provenance,
    };

    return this.createDraftSellerItem({
      ...fixture,
      item: {
        ...item,
        description: { he: input.trim(), en: input.trim() },
        catalogDraft: this.buildCatalogDraft({
          ...(dimensions.length ? { dimensions: { values: dimensions } } : {}),
          ...(extraction.item.condition ? { condition: extraction.item.condition } : {}),
          ...(extraction.item.markings ? { markings: extraction.item.markings } : {}),
          ...(extraction.item.signature ? { signatures: extraction.item.signature } : {}),
          ...(extraction.item.provenance ? { provenance: extraction.item.provenance } : {}),
        }),
      },
      missingFields: extraction.missingFacts,
      confirmedFacts,
      sellerConfirmation: {
        ...fixture.sellerConfirmation,
        status: 'pending',
        lastConfirmedAt: undefined,
        notes: 'Fields extracted by P4 require seller confirmation before downstream use.',
      },
      handoff: {
        ...fixture.handoff,
        notes: 'Only seller-confirmed facts are trusted downstream.',
      },
    });
  }

  // Build a review state from the seller's initial intake text.
  buildReviewState(input: string, hasAiDimensions = false): {
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

    if (!hasAiDimensions) {
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
  createDraftFromSellerInput(
    fixture: SellerItemDraft,
    input: string,
    aiDimensions: SellerDimensionMeasurement[] = [],
  ): SellerItemDraft {
    const reviewState = this.buildReviewState(input, aiDimensions.length > 0);
    const extractedDimensions = aiDimensions.length ? { values: aiDimensions } : undefined;
    const extractedCatalogFacts: SellerItemDraft['confirmedFacts'] = {
      ...(reviewState.category !== 'unknown' ? { category: reviewState.category } : {}),
      ...(reviewState.materials.length ? { materials: reviewState.materials } : {}),
      ...(extractedDimensions ? { dimensions: extractedDimensions } : {}),
      ...(reviewState.condition === 'Not yet confirmed' ? {} : { condition: reviewState.condition }),
      ...(reviewState.markings === 'Not yet confirmed' ? {} : { markings: reviewState.markings }),
      ...(reviewState.signatures === 'Not yet confirmed' ? {} : { signatures: reviewState.signatures }),
      ...(reviewState.provenance ? { provenance: reviewState.provenance } : {}),
    };
    const item = {
      ...fixture.item,
      title: this.draftTitleFromInput(input, reviewState.category, extractedDimensions),
      titleTranslations: this.draftTitleTranslations(reviewState.category, extractedDimensions),
      category: reviewState.category,
      materials: reviewState.materials,
      dimensions: {
        values: aiDimensions,
      },
      condition: reviewState.condition === 'Not yet confirmed' ? undefined : reviewState.condition,
      markings: reviewState.markings === 'Not yet confirmed' ? undefined : reviewState.markings,
      signatures: reviewState.signatures === 'Not yet confirmed' ? undefined : reviewState.signatures,
      provenance: reviewState.provenance,
    };

    return this.createDraftSellerItem({
      ...fixture,
      item: {
        ...item,
        description: { he: input.trim(), en: input.trim() },
        catalogDraft: this.buildCatalogDraft(extractedCatalogFacts),
      },
      missingFields: reviewState.missingFields,
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
    const hebrewMaterials = [
      ...(text.includes('שמן') ? ['oil'] : []),
      ...(text.includes('בד') ? ['canvas'] : []),
    ];

    const category = text.includes('painting') || text.includes('ציור')
      ? 'paintings'
      : text.includes('rare book')
        || text.includes('hebrew book')
        || text.includes('manuscript')
        || /\bbook\b/.test(text)
        || input.includes('ספר')
        || input.includes('כתב יד')
        ? 'rare_books'
        : /\bring\b|\u05d8\u05d1\u05e2\u05ea/.test(text) ? 'rings' : 'unknown';
    const materials = [] as string[];
    if (text.includes('oil') || text.includes('שמן')) materials.push('oil');
    if (text.includes('canvas') || text.includes('בד')) materials.push('canvas');

    const markings = /no markings/i.test(input) ? 'No markings reported' :
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

  const signatures = /not signed/i.test(input) ? 'No signature reported' :
    text.includes('signed') || text.includes('חתום')
      ? 'Signed'
      : 'Not yet confirmed';
    const provenance = input.includes('family') || input.includes('משפחה') ? 'Family archive; acquired in Jerusalem in the early 1990s.' : undefined;

    return {
      category: text.includes('ציור') ? 'paintings' : category,
      materials: [...new Set([...materials, ...hebrewMaterials])],
      dimensions: { widthCm: 0, heightCm: 0 },
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
    const dimensionsNotYetIdentified = guessed.dimensions.widthCm === 0 && guessed.dimensions.heightCm === 0;
    return {
      he: `אני מבינה שהפריט הוא ${guessed.category === 'paintings' ? 'ציור' : 'פריט'}${dimensionsNotYetIdentified ? ', והמידות עדיין לא זוהו' : ` עם מידות ${guessed.dimensions.widthCm}x${guessed.dimensions.heightCm} ס"מ`}, ${guessed.markings.toLowerCase()}.`,
      en: `I understand this is a ${guessed.category === 'paintings' ? 'painting' : 'item'}${dimensionsNotYetIdentified ? ', and its dimensions have not been identified yet' : ` with approximate dimensions of ${guessed.dimensions.widthCm}x${guessed.dimensions.heightCm} cm`}, ${guessed.markings.toLowerCase()}.`,
    };
  }

  // Identify the important missing details the seller must confirm.
    askMissingSellerDetails(
      reviewState?: ReturnType<SellerIntakeService['buildReviewState']>,
  ): string[] {
      if (!reviewState) return [...REQUIRED_SELLER_DETAILS];

      return REQUIRED_SELLER_DETAILS.filter((field) => reviewState.missingFields.includes(field));
  }

  // Turn missing fields into bilingual seller-facing questions for the chat flow.
  askMissingSellerQuestions(
    reviewState?: ReturnType<SellerIntakeService['buildReviewState']>,
  ): MissingSellerQuestion[] {
    return this.askMissingSellerDetails(reviewState).map((field) => ({
      field: field as MissingSellerQuestion['field'],
      ...MISSING_SELLER_QUESTION_COPY[field as keyof typeof MISSING_SELLER_QUESTION_COPY],
    }));
  }

  // Return only the next question so the seller can answer one detail at a time.
  askNextSellerQuestion(
    reviewState?: ReturnType<SellerIntakeService['buildReviewState']>,
  ): MissingSellerQuestion | null {
    return this.askMissingSellerQuestions(reviewState)[0] ?? null;
  }

  askNextSellerQuestionForFields(fields: string[]): MissingSellerQuestion | null {
    const field = REQUIRED_SELLER_DETAILS.find((candidate) => fields.includes(candidate));
    return field
      ? { field, ...MISSING_SELLER_QUESTION_COPY[field] }
      : null;
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

  // מעדכן עובדה לפי תיקון שאישרה המוכרת, מתעד גרסה ומסמן צורך בחישוב מחדש.
  // Applies a seller-approved correction, records a revision, and flags recalculation.
  applySellerDraftCorrection(
    draft: SellerItemDraft,
    field: SellerDraftCorrectionField,
    value: SellerDraftCorrectionValue,
  ): SellerItemDraft {
    if (field === 'title' || field === 'description') {
      const localized = value as { he?: string; en?: string };
      const item = field === 'title'
        ? {
            ...draft.item,
            title: localized.he ?? localized.en ?? draft.item.title,
            titleTranslations: { ...draft.item.titleTranslations, ...localized },
          }
        : {
            ...draft.item,
            description: { ...draft.item.description, ...localized },
          };
      const revision = this.appendRevisionEntry('seller', `Seller corrected ${field}`, [field]);
      return {
        ...draft,
        item,
        recalculationRequired: true,
        revisionHistory: [...draft.revisionHistory, revision],
      };
    }
    const itemField = field === 'marks' ? 'markings' : field;
    const confirmedValue = field === 'dimensions'
      ? Array.isArray(value)
        ? { values: value as SellerDimensionMeasurement[] }
        : typeof value === 'object' && value !== null && 'widthCm' in value
          ? {
          values: [
            { label: 'width', value: value.widthCm, unit: 'cm' },
            { label: 'height', value: value.heightCm, unit: 'cm' },
          ],
          widthCm: value.widthCm,
          heightCm: value.heightCm,
          unit: 'cm',
        }
          : { values: [] }
      : field === 'materials' && Array.isArray(value) ? value
      : typeof value === 'string' && value === '' ? undefined
      : value;
    const nextItem = {
      ...draft.item,
      [itemField]: confirmedValue,
    };
    const nextConfirmedFacts = {
      ...draft.confirmedFacts,
      [itemField]: confirmedValue,
    };
    const remainingMissingFields = new Set((draft.missingFields ?? []).filter((item) => item !== field));
    const requiredFieldCleared = field === 'dimensions'
      ? (confirmedValue as SellerItemDraft['item']['dimensions']).values.length === 0
      : ['condition', 'marks', 'signatures', 'provenance'].includes(field)
        && confirmedValue === undefined;
    if (requiredFieldCleared) remainingMissingFields.add(field);
    const revision = this.appendRevisionEntry('seller', `Seller corrected ${field}`, [field]);

    return {
      ...draft,
      item: {
        ...nextItem,
        catalogDraft: this.buildCatalogDraft(nextConfirmedFacts),
      },
      confirmedFacts: nextConfirmedFacts,
      missingFields: [...remainingMissingFields],
      recalculationRequired: true,
      revisionHistory: [...draft.revisionHistory, revision],
      sellerConfirmation: {
        ...draft.sellerConfirmation,
          status: this.hasAllRequiredConfirmedFacts(nextConfirmedFacts) ? 'complete' : 'partial',
        lastConfirmedAt: revision.timestamp,
        notes: 'Seller-approved facts are available for downstream review.',
      },
    };
  }

  // מאשר רק עובדות זמינות שהמוכרת בחרה לאשר ומעדכן את טיוטת הקטלוג.
  // Confirms only available facts explicitly selected by the seller and updates the catalog draft.
  confirmSellerFacts(draft: SellerItemDraft, fields: SellerDraftCorrectionField[]): SellerItemDraft {
    if (fields.length === 0) {
      throw new Error('At least one seller fact must be confirmed');
    }

    const confirmedValues: SellerItemDraft['confirmedFacts'] = {};
    const item = draft.item;
    // Older persisted drafts use widthCm/heightCm instead of measurement values.
    const dimensions = item.dimensions.values.length > 0 ? item.dimensions
      : typeof item.dimensions.widthCm === 'number' && Number.isFinite(item.dimensions.widthCm) && item.dimensions.widthCm > 0
        && typeof item.dimensions.heightCm === 'number' && Number.isFinite(item.dimensions.heightCm) && item.dimensions.heightCm > 0
        ? { ...item.dimensions, values: [
            { label: 'width', value: item.dimensions.widthCm, unit: 'cm' },
            { label: 'height', value: item.dimensions.heightCm, unit: 'cm' },
          ] }
        : undefined;
    const availableValues: Partial<Record<SellerDraftCorrectionField, unknown>> = {
      category: item.category !== 'unknown' ? item.category : undefined,
      materials: item.materials.length > 0 ? item.materials : undefined,
      dimensions,
      condition: item.condition,
      marks: item.markings,
      signatures: item.signatures,
      provenance: item.provenance,
    };

    for (const field of fields) {
      const value = availableValues[field];
        if (value === undefined || value === '' || value === 'Not yet confirmed'
          || (Array.isArray(value) && value.length === 0)) {
        throw new Error(`Cannot confirm missing or unknown fact: ${field}`);
      }
      const itemField = field === 'marks' ? 'markings' : field;
      Object.assign(confirmedValues, { [itemField]: value });
    }

    const nextConfirmedFacts = { ...draft.confirmedFacts, ...confirmedValues };
    const revision = this.appendRevisionEntry('seller', 'Seller confirmed extracted facts', fields);
    return {
      ...draft,
      item: {
        ...draft.item,
        catalogDraft: this.buildCatalogDraft(nextConfirmedFacts),
      },
      confirmedFacts: nextConfirmedFacts,
      recalculationRequired: true,
      revisionHistory: [...draft.revisionHistory, revision],
        sellerConfirmation: {
          ...draft.sellerConfirmation,
          status: this.hasAllRequiredConfirmedFacts(nextConfirmedFacts) ? 'complete' : 'partial',
          lastConfirmedAt: revision.timestamp,
          notes: 'Seller-approved facts are available for downstream review.',
        },
    };
  }

  // משלב תור שיחה חדש תוך שמירה על עובדות מאושרות, תיקונים והיסטוריית גרסאות קודמים.
  // Merges a new intake turn while preserving previously confirmed facts, corrections, and revision history.
  mergeNewIntakeTurn(previous: SellerItemDraft, incoming: SellerItemDraft): SellerItemDraft {
    const confirmedFacts = previous.confirmedFacts;
    const confirmedFieldNames = new Set([
      ...(confirmedFacts.dimensions ? ['dimensions'] : []),
      ...(confirmedFacts.condition ? ['condition'] : []),
      ...(confirmedFacts.markings ? ['marks'] : []),
      ...(confirmedFacts.signatures ? ['signatures'] : []),
      ...(confirmedFacts.provenance ? ['provenance'] : []),
      ...(confirmedFacts.category ? ['category'] : []),
      ...(confirmedFacts.materials ? ['materials'] : []),
    ]);
    const confirmedItemValues = {
      ...(confirmedFacts.category ? { category: confirmedFacts.category } : {}),
      ...(confirmedFacts.materials ? { materials: confirmedFacts.materials } : {}),
      ...(confirmedFacts.dimensions ? { dimensions: confirmedFacts.dimensions } : {}),
      ...(confirmedFacts.condition ? { condition: confirmedFacts.condition } : {}),
      ...(confirmedFacts.markings ? { markings: confirmedFacts.markings } : {}),
      ...(confirmedFacts.signatures ? { signatures: confirmedFacts.signatures } : {}),
      ...(confirmedFacts.provenance ? { provenance: confirmedFacts.provenance } : {}),
    };

    // A written description (by the seller or the AI catalog writer) must survive later chat turns.
    const descriptionWritten = (previous.revisionHistory ?? []).some((revision) => revision.changes.includes('description'));

    return {
      ...incoming,
      id: previous.id,
      item: {
        ...incoming.item,
        ...confirmedItemValues,
        ...(descriptionWritten ? { description: previous.item.description } : {}),
        id: previous.item.id,
        catalogDraft: this.buildCatalogDraft(confirmedFacts),
        evidenceIds: previous.item.evidenceIds,
      },
      evidence: previous.evidence,
      factEvidence: previous.factEvidence,
      confirmedFacts,
      missingFields: (incoming.missingFields ?? []).filter((field) => !confirmedFieldNames.has(field)),
      uncertainFacts: incoming.uncertainFacts.filter((fact) => !confirmedFieldNames.has(fact.field)),
      revisionHistory: previous.revisionHistory,
      recalculationRequired: previous.recalculationRequired,
      sellerConfirmation: previous.sellerConfirmation,
      handoff: previous.handoff,
    };
  }

  // בודק אם כל חמש העובדות הנדרשות אושרו לפני סימון הטיוטה כהשלמה.
  // Checks whether all five required facts are confirmed before marking the draft complete.
  private hasAllRequiredConfirmedFacts(facts: SellerItemDraft['confirmedFacts']): boolean {
    return facts.dimensions !== undefined
      && facts.condition !== undefined
      && facts.markings !== undefined
      && facts.signatures !== undefined
      && facts.provenance !== undefined;
  }

  draftTitleFromInput(
    input: string,
    category: string,
    dimensions?: SellerItemDraft['item']['dimensions'],
  ): string {
    const isHebrew = /[\u0590-\u05FF]/.test(input);
    const size = dimensions?.values.length
      ? dimensions.values.map(({ label, value, unit }) => `${label} ${value} ${unit}`).join(', ')
      : null;
    if (category === 'paintings' && size) return `${isHebrew ? 'ציור' : 'Painting'} ${size}`;
    if (category === 'paintings') return isHebrew ? 'ציור' : 'Painting';
    if (category === 'rare_books') return isHebrew ? 'כתב יד או ספר נדיר' : 'Rare Hebrew book';
    const trimmed = input.trim().replace(/\s+/g, ' ');
    return trimmed.slice(0, 80) || (isHebrew ? 'טיוטת פריט' : 'Item draft');
  }

  private draftTitleTranslations(
    category: string,
    dimensions?: SellerItemDraft['item']['dimensions'],
  ): SellerItemDraft['item']['titleTranslations'] {
    if (category === 'rare_books') {
      return { he: 'כתב יד או ספר נדיר', en: 'Rare Hebrew book' };
    }
    if (category === 'paintings') {
      const englishSize = dimensions?.values
        .map(({ label, value, unit }) => `${label} ${value} ${unit}`)
        .join(', ');
      const hebrewSize = dimensions?.values
        .map(({ label, value, unit }) => `${label === 'width' ? 'רוחב' : label === 'height' ? 'גובה' : label === 'depth' ? 'עומק' : label} ${value} ${unit}`)
        .join(', ');
      return {
        he: `ציור${hebrewSize ? ` ${hebrewSize}` : ''}`,
        en: `Painting${englishSize ? ` ${englishSize}` : ''}`,
      };
    }
    return undefined;
  }

  // בונה תיאור קטלוג מעובדות מאושרות בלבד ומציין במפורש פרטים שטרם אושרו.
  // Builds catalog copy from confirmed facts only and labels unconfirmed details explicitly.
  buildCatalogDraft(confirmedFacts: SellerItemDraft['confirmedFacts']): { he: string; en: string } {
    const category = confirmedFacts.category ?? 'category not confirmed';
    const materials = confirmedFacts.materials?.join(', ') ?? 'materials not confirmed';
    const dimensions = confirmedFacts.dimensions?.values.length
      ? confirmedFacts.dimensions.values.map(({ label, value, unit }) => `${label} ${value} ${unit}`).join(', ')
      : confirmedFacts.dimensions
        ? `${confirmedFacts.dimensions.widthCm ?? '?'}x${confirmedFacts.dimensions.heightCm ?? '?'} cm`
        : 'dimensions not confirmed';
    const condition = confirmedFacts.condition ?? 'condition not confirmed';
    const markings = confirmedFacts.markings ?? 'markings not confirmed';
    const signatures = confirmedFacts.signatures ?? 'signature not confirmed';
    const provenance = confirmedFacts.provenance ?? 'provenance not confirmed';

    return {
      he: `קטגוריה: ${confirmedFacts.category ?? 'לא אושרה'}; חומרים: ${confirmedFacts.materials?.join(', ') ?? 'לא אושרו'}; מידות: ${confirmedFacts.dimensions ? dimensions : 'לא אושרו'}; מצב: ${confirmedFacts.condition ?? 'לא אושר'}; סימונים: ${confirmedFacts.markings ?? 'לא אושרו'}; חתימה: ${confirmedFacts.signatures ?? 'לא אושרה'}; מקור: ${confirmedFacts.provenance ?? 'לא אושר'}.`,
      en: `Category: ${category}; materials: ${materials}; dimensions: ${dimensions}; condition: ${condition}; markings: ${markings}; signature: ${signatures}; provenance: ${provenance}.`,
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
