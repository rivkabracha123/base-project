import { z } from 'zod';

const text = z.string().trim().min(1);

/** URL provenance must be verified by the backend; syntax alone cannot prove publicity. */
export const dashboardValuationSourceSchema = z.object({
  label: text,
  url: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && !url.search && !url.hash;
  }, 'Use a verified public HTTPS lot URL without credentials, query or fragment').nullable(),
}).strict();

const comparable = z.object({
  id: text,
  source: dashboardValuationSourceSchema,
  saleDate: z.string().date(),
  originalPrice: z.number().finite().positive(),
  originalCurrency: z.string().regex(/^[A-Z]{3}$/),
  normalizedPrice: z.number().finite().positive().optional(),
  weight: z.number().finite().positive().max(1).optional(),
}).strict();

const common = {
  reportId: text,
  comparableCount: z.number().int().nonnegative(),
  limitations: z.array(text).min(1),
  // Also present on refusal: accepted evidence can remain insufficient for a range.
  comparables: z.array(comparable),
  excludedComparables: z.array(z.object({ id: text, reason: text }).strict()),
};

export const dashboardValuationSchema = z.discriminatedUnion('status', [
  z.object({
    ...common,
    status: z.literal('supported'),
    valuationRange: z.object({
      min: z.number().finite().positive(),
      max: z.number().finite().positive(),
      currency: z.literal('USD'),
    }).strict().refine(range => range.min <= range.max, 'Range must be ordered'),
    confidence: z.object({
      level: z.enum(['low', 'medium', 'high']),
      explanation: text,
    }).strict(),
  }).strict(),
  z.object({ ...common, status: z.literal('refusal'), reason: text }).strict(),
]).superRefine((value, ctx) => {
  const included = value.comparables.map(sale => sale.id);
  const excluded = value.excludedComparables.map(sale => sale.id);
  if (value.comparableCount !== included.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Count must match accepted evidence' });
  }
  if (new Set([...included, ...excluded]).size !== included.length + excluded.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Evidence IDs must be unique and disjoint' });
  }
});

/** Server-only frozen-at-submission snapshot. Return only dashboard to P5. */
export const sellerLeadValuationSnapshotSchema = z.object({
  itemId: text,
  itemVersion: text,
  calculationVersion: text,
  dashboard: dashboardValuationSchema,
}).strict();

export type DashboardValuationDto = z.infer<typeof dashboardValuationSchema>;
export type DashboardValuationSource = z.infer<typeof dashboardValuationSourceSchema>;
export type SellerLeadValuationSnapshot = z.infer<typeof sellerLeadValuationSnapshotSchema>;
