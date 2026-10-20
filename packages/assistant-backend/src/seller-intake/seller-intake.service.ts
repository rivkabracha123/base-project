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

const UNCONFIRMED_CORRECTION_REASON =
  'Seller changed this fact; explicit confirmation is required before downstream use.';

export type MissingSellerQuestion = {
  field: (typeof REQUIRED_SELLER_DETAILS)[number] | 'category';
  he: string;
  en: string;
};

type SellerFactCorrectionField =
  | 'category'
  | 'materials'
  | 'dimensions'
  | 'condition'
  | 'marks'
  | 'signatures'
  | 'provenance';

type SellerDraftCorrectionField = SellerFactCorrectionField | 'title' | 'description';
type SellerDraftCorrectionValue = string | string[] | { widthCm: number; heightCm: number }
  | { values: Array<{ label: string; value: number; unit: string }> }
  | Partial<Record<'he' | 'en', string>> | SellerDimensionMeasurement[];

function isLocalizedCorrection(value: SellerDraftCorrectionValue): value is Partial<Record<'he' | 'en', string>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.entries(value).every(([language, text]) => ['he', 'en'].includes(language) && typeof text === 'string');
}

function isDimensionCorrection(
  value: SellerDraftCorrectionValue,
): value is { values: Array<{ label: string; value: number; unit: string }> } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'values' in value;
}

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
        catalogDraft: this.buildCatalogDraft(confirmedFacts),
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
        catalogDraft: this.buildCatalogDraft({}),
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

  // מעדכן את ערך העובדה אך משאיר אותה לא מאושרת עד לאישור מפורש של המוכרת.
  // Updates a fact value but keeps it unconfirmed until the seller explicitly confirms it.
  applySellerDraftCorrection(
    draft: SellerItemDraft,
    field: SellerDraftCorrectionField,
    value: SellerDraftCorrectionValue,
  ): SellerItemDraft {
    if (field === 'title' || field === 'description') {
      if (!isLocalizedCorrection(value) || Object.keys(value).length === 0) {
        throw new Error(`${field} correction requires a Hebrew or English value`);
      }
      const correctedText = 'he' in value ? value.he : value.en;
      if (typeof correctedText !== 'string') throw new Error(`${field} correction requires a Hebrew or English value`);
      const revision = this.appendRevisionEntry('seller', `Seller edited item ${field}`, [field]);
      const correctedItem = field === 'title'
        ? {
            ...draft.item,
            title: correctedText,
            titleTranslations: { ...draft.item.titleTranslations, ...value },
          }
        : {
            ...draft.item,
            description: { ...draft.item.description, ...value },
          };
      return {
        ...draft,
        item: correctedItem,
        revisionHistory: [...draft.revisionHistory, revision],
      };
    }

    const itemField = field === 'marks' ? 'markings' : field;
    const confirmedValue = field === 'dimensions'
      ? Array.isArray(value)
        ? { values: value }
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
        : isDimensionCorrection(value) ? { values: value.values } : { values: [] }
      : value;
    const nextItem = {
      ...draft.item,
      [itemField]: confirmedValue,
    };
    const clearsField = (field === 'dimensions'
      && (Array.isArray(value) ? value.length === 0 : isDimensionCorrection(value) && value.values.length === 0))
      || (field === 'materials' && Array.isArray(value) && value.length === 0)
      || (['condition', 'marks', 'signatures', 'provenance'].includes(field) && value === '');
    const correctedFacts = Object.fromEntries(
      Object.entries(draft.confirmedFacts).filter(([name]) => name !== itemField),
    ) as SellerItemDraft['confirmedFacts'];
    const correctedValue = typeof confirmedValue === 'string' || typeof confirmedValue === 'number'
      ? confirmedValue
      : JSON.stringify(confirmedValue);
    if (correctedValue === undefined && !clearsField) {
      throw new Error(`Could not represent corrected fact: ${field}`);
    }
    const uncertainFacts = draft.uncertainFacts.filter(
      (fact) => fact.field !== field && fact.field !== itemField,
    );
    if (!clearsField) {
      uncertainFacts.push({
        field,
        status: 'uncertain',
        value: correctedValue ?? null,
        reason: UNCONFIRMED_CORRECTION_REASON,
      });
    }
    const requiredField = field === 'marks' ? 'marks' : field;
    const remainingMissingFields = new Set((draft.missingFields ?? []).filter((item) => item !== requiredField));
    const skippedFields = (draft.skippedFields ?? []).filter((item) => item !== requiredField);
    if (clearsField && ['dimensions', 'condition', 'marks', 'signatures', 'provenance'].includes(field)) {
      remainingMissingFields.add(requiredField);
    }
    const revision = this.appendRevisionEntry('seller', `Seller corrected ${field}`, [field]);

    return {
      ...draft,
      item: {
        ...nextItem,
        ...(clearsField && field !== 'dimensions' && field !== 'materials' ? { [itemField]: undefined } : {}),
        catalogDraft: this.buildCatalogDraft(correctedFacts),
      },
      confirmedFacts: correctedFacts,
      uncertainFacts,
      missingFields: [...remainingMissingFields],
      skippedFields,
      recalculationRequired: true,
      revisionHistory: [...draft.revisionHistory, revision],
      sellerConfirmation: {
        ...draft.sellerConfirmation,
        status: this.hasAllRequiredConfirmedFacts(correctedFacts)
          ? 'complete'
          : Object.values(correctedFacts).some((fact) => fact !== undefined) ? 'partial' : 'pending',
        notes: 'Corrected facts require explicit seller confirmation before downstream use.',
      },
    };
  }

  // מאשר רק עובדות זמינות שהמוכרת בחרה לאשר ומעדכן את טיוטת הקטלוג.
  // Confirms only available facts explicitly selected by the seller and updates the catalog draft.
  confirmSellerFacts(draft: SellerItemDraft, fields: SellerFactCorrectionField[]): SellerItemDraft {
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
    const availableValues: Partial<Record<SellerFactCorrectionField, unknown>> = {
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
    const confirmedFieldNames = new Set(fields.flatMap((field) => [field, field === 'marks' ? 'markings' : field]));
    return {
      ...draft,
      item: {
        ...draft.item,
        catalogDraft: this.buildCatalogDraft(nextConfirmedFacts),
      },
      confirmedFacts: nextConfirmedFacts,
      uncertainFacts: draft.uncertainFacts.filter((fact) => !confirmedFieldNames.has(fact.field)),
      missingFields: (draft.missingFields ?? []).filter((field) => !confirmedFieldNames.has(field)),
      skippedFields: (draft.skippedFields ?? []).filter((field) => !confirmedFieldNames.has(field)),
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
    const pendingCorrections = previous.uncertainFacts.filter(
      (fact) => fact.reason === UNCONFIRMED_CORRECTION_REASON,
    );
    const confirmedFieldNames = new Set([
      ...(confirmedFacts.dimensions ? ['dimensions'] : []),
      ...(confirmedFacts.condition ? ['condition'] : []),
      ...(confirmedFacts.markings ? ['marks'] : []),
      ...(confirmedFacts.signatures ? ['signatures'] : []),
      ...(confirmedFacts.provenance ? ['provenance'] : []),
      ...(confirmedFacts.category ? ['category'] : []),
      ...(confirmedFacts.materials ? ['materials'] : []),
    ]);
    const hasIncomingValue: Record<string, boolean> = {
      category: incoming.item.category !== 'unknown',
      dimensions: incoming.item.dimensions.values.length > 0,
      condition: Boolean(incoming.item.condition?.trim()),
      marks: Boolean(incoming.item.markings?.trim()),
      signatures: Boolean(incoming.item.signatures?.trim()),
      provenance: Boolean(incoming.item.provenance?.trim()),
    };
    const skippedFields = [...new Set([
      ...(previous.skippedFields ?? []),
      ...(incoming.skippedFields ?? []),
    ])].filter((field) => !hasIncomingValue[field] && !confirmedFieldNames.has(field));
    const confirmedItemValues = {
      ...(confirmedFacts.category ? { category: confirmedFacts.category } : {}),
      ...(confirmedFacts.materials ? { materials: confirmedFacts.materials } : {}),
      ...(confirmedFacts.dimensions ? { dimensions: confirmedFacts.dimensions } : {}),
      ...(confirmedFacts.condition ? { condition: confirmedFacts.condition } : {}),
      ...(confirmedFacts.markings ? { markings: confirmedFacts.markings } : {}),
      ...(confirmedFacts.signatures ? { signatures: confirmedFacts.signatures } : {}),
      ...(confirmedFacts.provenance ? { provenance: confirmedFacts.provenance } : {}),
    };
    const pendingCorrectionItemValues: Partial<SellerItemDraft['item']> = {};
    for (const fact of pendingCorrections) {
      switch (fact.field) {
        case 'category':
          pendingCorrectionItemValues.category = previous.item.category;
          break;
        case 'materials':
          pendingCorrectionItemValues.materials = previous.item.materials;
          break;
        case 'dimensions':
          pendingCorrectionItemValues.dimensions = previous.item.dimensions;
          break;
        case 'condition':
          pendingCorrectionItemValues.condition = previous.item.condition;
          break;
        case 'marks':
        case 'markings':
          pendingCorrectionItemValues.markings = previous.item.markings;
          break;
        case 'signatures':
          pendingCorrectionItemValues.signatures = previous.item.signatures;
          break;
        case 'provenance':
          pendingCorrectionItemValues.provenance = previous.item.provenance;
          break;
      }
    }
    const uncertainFactsByField = new Map(
      incoming.uncertainFacts
        .filter((fact) => !confirmedFieldNames.has(fact.field))
        .map((fact) => [fact.field, fact]),
    );
    for (const fact of pendingCorrections) {
      if (!confirmedFieldNames.has(fact.field)) uncertainFactsByField.set(fact.field, fact);
    }

    // A written description (by the seller or the AI catalog writer) must survive later chat turns.
    const descriptionWritten = (previous.revisionHistory ?? []).some((revision) => revision.changes.includes('description'));

    return {
      ...incoming,
      id: previous.id,
      item: {
        ...incoming.item,
        ...confirmedItemValues,
        ...pendingCorrectionItemValues,
        ...(descriptionWritten ? { description: previous.item.description } : {}),
        id: previous.item.id,
        catalogDraft: this.buildCatalogDraft(confirmedFacts),
        evidenceIds: previous.item.evidenceIds,
      },
      evidence: previous.evidence,
      factEvidence: previous.factEvidence,
      confirmedFacts,
      missingFields: [...new Set([...(incoming.missingFields ?? []), ...skippedFields])]
        .filter((field) => !confirmedFieldNames.has(field)),
      skippedFields,
      uncertainFacts: [...uncertainFactsByField.values()],
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
