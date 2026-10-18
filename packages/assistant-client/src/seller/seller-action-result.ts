import { z } from 'zod';
import { auctionLotSchema, confirmedItemDraftSchema, houseRankingSchema } from '@monabid/shared';

const enquiryDraftSchema = confirmedItemDraftSchema.extend({
  evidence: confirmedItemDraftSchema.shape.evidence.removeDefault(),
  item: confirmedItemDraftSchema.shape.item.extend({
    evidenceIds: confirmedItemDraftSchema.shape.item.shape.evidenceIds.removeDefault(),
  }),
});

export const sellerActionResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('catalog'), title: z.string(), he: z.string(), en: z.string() }),
  z.object({ kind: z.literal('enquiry'), draft: enquiryDraftSchema, ranking: houseRankingSchema }),
  z.object({ kind: z.literal('valuation'), status: z.enum(['supported', 'refusal']),
    valuationRange: z.object({ min: z.number(), max: z.number(), currency: z.string() }).optional(),
    confidence: z.object({ level: z.enum(['low', 'medium', 'high']), explanation: z.string() }).optional(),
    comparableCount: z.number().int().nonnegative(), reason: z.string().optional(),
    lots: z.array(auctionLotSchema),
  }),
]);

export type SellerActionResult = z.infer<typeof sellerActionResultSchema>;
