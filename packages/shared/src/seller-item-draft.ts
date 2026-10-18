import { z } from 'zod';

// Tamar Zingerovitz — minimum message contract: the typed draft exchanged by the seller-intake boundary.
export const sellerItemEvidenceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  source: z.string().min(1),
  uri: z.string().min(1).optional(),
  value: z.string().optional(),
  confidence: z.string().optional(),
  caption: z.record(z.string()).optional(),
  originalName: z.string().min(1).optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  size: z.number().nonnegative().optional(),
  profileId: z.string().min(1).optional(),
  previewUri: z.string().min(1).optional(),
});

export const sellerEvidenceReferenceSchema = z.object({
  fileId: z.string().min(1),
  profileId: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().nonnegative(),
  previewUri: z.string().min(1),
});

export type SellerEvidenceReference = z.infer<typeof sellerEvidenceReferenceSchema>;

export const sellerFactStatusSchema = z.enum(['confirmed', 'uncertain', 'unknown', 'incomplete']);

export const sellerDimensionMeasurementSchema = z.object({
  label: z.string().min(1),
  value: z.number().nonnegative(),
  unit: z.string().min(1),
});
export type SellerDimensionMeasurement = z.infer<typeof sellerDimensionMeasurementSchema>;

export const sellerDimensionsSchema = z.object({
  values: z.array(sellerDimensionMeasurementSchema).default([]),
  widthCm: z.number().nonnegative().optional(),
  heightCm: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  confidence: z.string().optional(),
  confirmedBy: z.string().optional(),
});

export const sellerItemDraftSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  developer: z.string().min(1),
  week: z.number().int().positive(),
  status: z.enum(['draft', 'review', 'confirmed']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  language: z.object({
    preferred: z.string().min(1),
    secondary: z.string().min(1),
    conversationMode: z.string().min(1),
  }),
  seller: z.object({
    anonymousProfileId: z.string().min(1),
    name: z.string().min(1),
    preferredName: z.string().min(1),
  }),
  conversation: z.object({
    prompt: z.object({ he: z.string(), en: z.string() }),
    assistantSummary: z.object({ he: z.string(), en: z.string() }),
  }),
  item: z.object({
    id: z.string().min(1),
    category: z.string().min(1),
    title: z.string().min(1),
    titleTranslations: z.object({ he: z.string().optional(), en: z.string().optional() }).optional(),
    description: z.object({ he: z.string(), en: z.string() }),
    materials: z.array(z.string()).default([]),
    dimensions: sellerDimensionsSchema,
    condition: z.string().optional(),
    markings: z.string().optional(),
    signatures: z.string().optional(),
    provenance: z.string().optional(),
    eraGuess: z.string().optional(),
    source: z.string().min(1),
    evidenceIds: z.array(z.string()),
    catalogDraft: z.object({ he: z.string(), en: z.string() }),
  }),
  evidence: z.array(sellerItemEvidenceSchema),
  factEvidence: z.record(z.array(z.string())).optional(),
  missingFields: z.array(z.string()).optional(),
  skippedFields: z.array(z.string()).optional(),
  recalculationRequired: z.boolean().optional(),
  // Yael Sagis — photo references: evidence items are references, not storage or valuation logic.
  // Heni Cohen — confirmed facts: trusted seller-approved fields remain separate from uncertainFacts.
  confirmedFacts: z.object({
    category: z.string().optional(),
    materials: z.array(z.string()).optional(),
    dimensions: sellerDimensionsSchema.optional(),
    condition: z.string().optional(),
    markings: z.string().optional(),
    signatures: z.string().optional(),
    provenance: z.string().optional(),
  }),
  uncertainFacts: z.array(z.object({
    field: z.string().min(1),
    status: sellerFactStatusSchema,
    value: z.union([z.string(), z.number(), z.null()]),
    reason: z.string().optional(),
    language: z.string().optional(),
  })),
  revisionHistory: z.array(z.object({
    revisionId: z.string().min(1),
    timestamp: z.string().datetime(),
    actor: z.enum(['seller', 'assistant', 'system']),
    summary: z.string().min(1),
    changes: z.array(z.string()),
  })),

  sellerConfirmation: z.object({
    required: z.boolean(),
    status: z.enum(['partial', 'complete', 'pending']),
    lastConfirmedAt: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
  // Rachel Hadassah Hyde — final lead / downstream handoff: the draft is handed off only when it is review-ready.
  handoff: z.object({
    to: z.array(z.enum(['s3', 's4', 's5'])),
    status: z.enum(['ready_for_review', 'blocked']),
    notes: z.string().optional(),
  }),
  safetyRules: z.object({
    sellerConfirmsExtractedFacts: z.boolean(),
    askForMissingDimensionsConditionMarksSignaturesAndProvenance: z.boolean(),
    weakEvidenceNeverProducesInventedPrice: z.boolean(),
    noHouseRecommendation: z.boolean(),
    noValuation: z.boolean(),
    noContactCapture: z.boolean(),
  }),
});

export type SellerItemEvidence = z.infer<typeof sellerItemEvidenceSchema>;
export type SellerFactStatus = z.infer<typeof sellerFactStatusSchema>;
export type SellerItemDraft = z.infer<typeof sellerItemDraftSchema>;
