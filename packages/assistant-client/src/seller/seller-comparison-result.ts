import { z } from 'zod';
import { auctionLotSchema, sellerItemDraftSchema } from '@monabid/shared';

export const sellerComparisonResultSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('details'), evidence: sellerItemDraftSchema.shape.evidence.optional(), item: sellerItemDraftSchema.shape.item.extend({
    materials: z.array(z.string()),
    dimensions: sellerItemDraftSchema.shape.item.shape.dimensions.extend({
      values: z.array(sellerItemDraftSchema.shape.item.shape.dimensions.shape.values.removeDefault().element),
    }),
  }) }),
  z.object({
    mode: z.enum(['search', 'history', 'trend']),
    criteria: z.object({ category: z.string(), materials: z.array(z.string()).optional() }),
    lots: z.array(auctionLotSchema),
  }),
]);

export type SellerComparisonResult = z.infer<typeof sellerComparisonResultSchema>;

export const sellerComparisonModes: Record<string, 'search' | 'history' | 'trend' | 'details'> = {
  searchSellerComparables: 'search',
  getSellerComparableHistory: 'history',
  getSellerPriceTrend: 'trend',
  getSellerItemDetails: 'details',
};
