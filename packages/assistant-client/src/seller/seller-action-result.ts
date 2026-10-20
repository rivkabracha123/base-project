import { z } from 'zod';
import {
  auctionLotSchema,
  sellerDimensionMeasurementSchema,
  sellerItemEvidenceSchema,
} from '@monabid/shared';

const enquiryDraftSchema = z.object({
  evidence: z.array(sellerItemEvidenceSchema),
  item: z.object({
    id: z.string().min(1),
    category: z.string().min(1),
    title: z.string().min(1),
    evidenceIds: z.array(z.string()),
    catalogDraft: z.object({ he: z.string(), en: z.string() }),
    source: z.string(),
    description: z.object({ he: z.string(), en: z.string() }),
    materials: z.array(z.string()),
    dimensions: z.object({
      values: z.array(sellerDimensionMeasurementSchema),
      widthCm: z.number().optional(),
      heightCm: z.number().optional(),
      unit: z.string().optional(),
      confidence: z.string().optional(),
      confirmedBy: z.string().optional(),
    }),
    condition: z.string().optional(),
    markings: z.string().optional(),
    signatures: z.string().optional(),
    provenance: z.string().optional(),
  }).passthrough(),
}).passthrough();

export const sellerActionResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catalog'), title: z.string(), he: z.string(), en: z.string(), generatedByAi: z.boolean().optional() }),
  z.object({
    kind: z.literal('enquiry'),
    draft: enquiryDraftSchema,
    enquiryText: z.string().min(1),
    generatedByAi: z.boolean(),
  }),
  z.object({ kind: z.literal('valuation'), status: z.enum(['supported', 'refusal']),
    valuationRange: z.object({ min: z.number(), max: z.number(), currency: z.string() }).optional(),
    confidence: z.object({ level: z.enum(['low', 'medium', 'high']), explanation: z.string() }).optional(),
    comparableCount: z.number().int().nonnegative(), reason: z.string().optional(),
    lots: z.array(auctionLotSchema),
  }),
]);

export type SellerActionResult = z.infer<typeof sellerActionResultSchema>;
