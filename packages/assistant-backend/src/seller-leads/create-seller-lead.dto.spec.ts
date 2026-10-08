import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { CreateSellerLeadDto } from './create-seller-lead.dto';

const profileId = 'profile-synthetic-1';
const preferredName = 'Synthetic Seller';
const email = 'synthetic.seller@example.test';
const phone = '+972500000000';

function failedPathsOf(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [...(error.constraints ? [path] : []), ...failedPathsOf(error.children ?? [], path)];
  });
}

// Mirrors the global ValidationPipe configured in src/main.ts.
function validateEnquiry(payload: Record<string, unknown>): { dto: CreateSellerLeadDto; failedPaths: string[] } {
  const dto = plainToInstance(CreateSellerLeadDto, payload);
  return { dto, failedPaths: failedPathsOf(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })) };
}

describe('CreateSellerLeadDto', () => {
  it('rejects a draft enquiry without a preferred name', () => {
    const { failedPaths } = validateEnquiry({
      profileId,
      contact: { email },
      serviceConsent: true,
    });

    expect(failedPaths).toContain('contact.preferredName');
  });

  it('rejects a draft enquiry with neither email nor phone', () => {
    const { failedPaths } = validateEnquiry({
      profileId,
      contact: { preferredName },
      serviceConsent: true,
    });

    expect(failedPaths).toContain('contact');
  });

  it('accepts a draft enquiry with email only', () => {
    const { dto, failedPaths } = validateEnquiry({
      profileId,
      contact: { preferredName, email },
      serviceConsent: true,
    });

    expect(failedPaths).toEqual([]);
    expect(dto.contact.email).toBe(email);
    expect(dto.contact.phone).toBeUndefined();
  });

  it('accepts a draft enquiry with phone only', () => {
    const { dto, failedPaths } = validateEnquiry({
      profileId,
      contact: { preferredName, phone },
      serviceConsent: true,
    });

    expect(failedPaths).toEqual([]);
    expect(dto.contact.phone).toBe(phone);
    expect(dto.contact.email).toBeUndefined();
  });

  it('rejects a draft enquiry whose email is malformed', () => {
    const { failedPaths } = validateEnquiry({
      profileId,
      contact: { preferredName, email: 'not-an-email' },
      serviceConsent: true,
    });

    expect(failedPaths).toContain('contact.email');
  });

  it('rejects a draft enquiry without explicit service-contact consent', () => {
    expect(validateEnquiry({ profileId, contact: { preferredName, email } }).failedPaths).toContain('serviceConsent');

    expect(
      validateEnquiry({ profileId, contact: { preferredName, email }, serviceConsent: false }).failedPaths,
    ).toContain('serviceConsent');
  });

  it('accepts profileId as an opaque reference', () => {
    const { dto, failedPaths } = validateEnquiry({
      profileId: 'any-opaque-session-token',
      contact: { preferredName, email },
      serviceConsent: true,
    });

    expect(failedPaths).toEqual([]);
    expect(dto.profileId).toBe('any-opaque-session-token');
  });
});
