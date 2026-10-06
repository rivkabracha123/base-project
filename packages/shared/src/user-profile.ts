import { z } from 'zod';

export const consentRecordSchema = z.object({
  granted: z.boolean(),
  grantedAt: z.string().datetime().optional(),
  channel: z.string().min(1).optional(),
  policyVersion: z.string().min(1).optional(),
});

export const userProfileSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  language: z.enum(['he', 'en']),
  grammaticalForm: z.enum(['masculine', 'feminine', 'neutral', 'unspecified']).optional(),
  preferredName: z.string().min(1).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  serviceConsent: consentRecordSchema,
  marketingConsent: consentRecordSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const userProfileFixtureSchema = z.array(userProfileSchema).min(1);

export type ConsentRecord = z.infer<typeof consentRecordSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
