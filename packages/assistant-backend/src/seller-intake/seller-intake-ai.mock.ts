import { Injectable } from '@nestjs/common';
import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeService } from './seller-intake.service';
import type { MissingSellerQuestion } from './seller-intake.service';
import type { SellerIntakeAiProvider, SellerIntakeAiResult } from './seller-intake-ai.provider';

const createDeterministicSellerItemDraft = (): SellerItemDraft => ({
  id: 'seller-item-draft-001',
  feature: 'seller-conversation',
  developer: 's1',
  week: 3,
  status: 'draft',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
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
  conversation: {
    prompt: {
      he: 'יש לי ציור, אני רוצה לבדוק פרטים.',
      en: 'I have a painting and want to confirm details.',
    },
    assistantSummary: {
      he: 'הפריט נבחן כדי לאסוף פרטים חסרים.',
      en: 'The item is being reviewed to capture missing details.',
    },
  },
  item: {
    id: 'item-001',
    category: 'paintings',
    title: 'Abstract landscape study',
    description: {
      he: 'מחקר נוף מופשט',
      en: 'Abstract landscape study',
    },
    materials: ['oil', 'canvas'],
    dimensions: {
      values: [
        { label: 'width', value: 60, unit: 'cm' },
        { label: 'height', value: 80, unit: 'cm' },
      ],
      widthCm: 60,
      heightCm: 80,
      unit: 'cm',
    },
    source: 'seller-intake',
    evidenceIds: ['evidence-001'],
    catalogDraft: {
      he: 'מחקר נוף מופשט',
      en: 'Abstract landscape study',
    },
  },
  evidence: [
    {
      id: 'evidence-001',
      type: 'seller_statement',
      source: 'seller',
      value: 'painting',
      confidence: 'high',
    },
  ],
  confirmedFacts: {
    category: 'paintings',
    dimensions: {
      values: [
        { label: 'width', value: 60, unit: 'cm' },
        { label: 'height', value: 80, unit: 'cm' },
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
});

// Simulates Shilat Ben Gigi — AI connection: deterministic seller-intake output without external JSON files.
@Injectable()
export class SellerIntakeAiMock implements SellerIntakeAiProvider {
  private readonly sessions = new Map<string, { input: string }>();

  constructor(private readonly sellerIntakeService: SellerIntakeService) {}

  analyze(input: string, sessionId?: string): SellerIntakeAiResult {
    const fixture = createDeterministicSellerItemDraft();
    const previous = sessionId ? this.sessions.get(sessionId) : undefined;
    const previousState = previous
      ? this.sellerIntakeService.buildReviewState(previous.input)
      : undefined;
    const expectedQuestion = previousState
      ? this.sellerIntakeService.askNextSellerQuestion(previousState)
      : null;
    const answerAccepted = !previous || !expectedQuestion || this.answerMatchesField(expectedQuestion.field, input);
    const answerError = answerAccepted
      ? undefined
      : `Answer does not match the requested field: ${expectedQuestion?.field}`;
    const combinedInput = previous && answerAccepted
      ? `${previous.input} ${input}`
      : previous?.input ?? input;

    if (sessionId && answerAccepted) {
      this.sessions.set(sessionId, { input: combinedInput });
    }

    const reviewState = this.sellerIntakeService.buildReviewState(combinedInput);

    return {
      ...this.sellerIntakeService.createDraftFromSellerInput(fixture, combinedInput),
      missingFields: this.sellerIntakeService.askMissingSellerDetails(reviewState),
      nextQuestion: this.sellerIntakeService.askNextSellerQuestion(reviewState),
      provider: 'fixture-mock' as const,
      ...(sessionId ? { sessionId } : {}),
      ...(previous ? { answerAccepted } : {}),
      ...(answerError ? { answerError } : {}),
    };
  }

  private answerMatchesField(field: MissingSellerQuestion['field'], input: string): boolean {
    const text = input.toLowerCase();

    if (field === 'dimensions') return /\d+\s*(?:x|על|by)\s*\d+/i.test(input);
    if (field === 'condition') return text.includes('condition') || text.includes('מצב') || text.includes('repair') || text.includes('damag');
    if (field === 'marks') return text.includes('mark') || text.includes('stamp') || text.includes('inscription') || input.includes('סימן') || input.includes('חותמת') || input.includes('כיתוב');
    if (field === 'signatures') return text.includes('signed') || text.includes('signature') || text.includes('חתום') || text.includes('חתימה');
    return text.includes('family') || text.includes('provenance') || text.includes('history') || input.includes('משפחה') || input.includes('מקור') || input.includes('היסטוריה');
  }
}
