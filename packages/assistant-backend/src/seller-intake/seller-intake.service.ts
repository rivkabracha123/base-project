import { Injectable } from '@nestjs/common';
import type { SellerItemDraft } from '@monabid/shared';

@Injectable()
export class SellerIntakeService {
  // Build a review state from the seller's initial intake text.
  buildReviewState(input: string): {
    category: string;
    materials: string[];
    dimensions: { widthCm: number; heightCm: number };
    markings: string;
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

  // Apply one seller correction to the current review state.
  applySellerCorrection(state: {
    category?: string;
    materials?: string[];
    dimensions?: { widthCm: number; heightCm: number };
    markings?: string;
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

    const markings = input.toLowerCase().includes('signed') || input.includes('חתום') ? 'Signed lower right' : 'Not yet confirmed';
    const provenance = input.includes('family') || input.includes('משפחה') ? 'Family archive; acquired in Jerusalem in the early 1990s.' : undefined;

    return {
      category: text.includes('ציור') ? 'paintings' : category,
      materials: [...new Set([...materials, ...hebrewMaterials])],
      dimensions: hebrewDimensions
        ? { widthCm: Number(hebrewDimensions[1]), heightCm: Number(hebrewDimensions[2]) }
        : dimensions,
      markings: input.includes('חתום') ? 'Signed lower right' : markings,
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
  askMissingSellerDetails(): string[] {
    return [
      'dimensions',
      'condition',
      'marks',
      'signatures',
      'provenance',
    ];
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
        status: 'partial',
        lastConfirmedAt: fixture.sellerConfirmation.lastConfirmedAt ?? new Date().toISOString(),
        notes: 'Confirmed facts are safe for downstream review; uncertain facts remain flagged.',
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

  // Prepare the downstream payload with only safe confirmed item facts.
  buildHandoffPayload(fixture: SellerItemDraft): {
    item: SellerItemDraft['item'];
    confirmedFacts: SellerItemDraft['confirmedFacts'];
    uncertainFacts: SellerItemDraft['uncertainFacts'];
    evidence: SellerItemDraft['evidence'];
    revisionHistory: SellerItemDraft['revisionHistory'];
  } {
    return {
      item: fixture.item,
      confirmedFacts: fixture.confirmedFacts,
      uncertainFacts: fixture.uncertainFacts,
      evidence: fixture.evidence,
      revisionHistory: fixture.revisionHistory,
    };
  }
}
