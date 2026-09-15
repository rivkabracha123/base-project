import { Injectable } from '@nestjs/common';
import type { SellerItemDraft } from '@monabid/shared';
import { SellerIntakeService } from './seller-intake.service';

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
export class SellerIntakeAiMock {
  constructor(private readonly sellerIntakeService: SellerIntakeService) {}

  analyze(input: string): SellerItemDraft & {
    provider: 'fixture-mock';
    missingFields: string[];
  } {
    const fixture = createDeterministicSellerItemDraft();
    const reviewState = this.sellerIntakeService.buildReviewState(input);

    return {
      ...this.sellerIntakeService.createDraftFromSellerInput(fixture, input),
      missingFields: this.sellerIntakeService.askMissingSellerDetails(reviewState),
      provider: 'fixture-mock' as const,
    };
  }
}
