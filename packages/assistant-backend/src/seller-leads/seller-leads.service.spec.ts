import type { LoggerService } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SellerLeadEntity } from '../database/seller-lead.entity';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';
import { SellerLeadsService } from './seller-leads.service';

const enquiry = {
  profileId: 'profile-synthetic-1',
  contact: {
    preferredName: 'Synthetic Seller',
    email: 'synthetic.seller@example.test',
    phone: '+972500000000',
  },
  serviceConsent: true,
} as CreateSellerLeadDto;

function createHarness() {
  const logged: unknown[] = [];
  const record = (...args: unknown[]): void => {
    logged.push(...args);
  };
  const logger = { log: record, error: record, warn: record, debug: record, verbose: record } as LoggerService;

  const saved: Record<string, unknown>[] = [];
  const repository = {
    create: jest.fn((lead: Record<string, unknown>) => lead),
    save: jest.fn(async (lead: Record<string, unknown>) => {
      saved.push(lead);
      return { id: 'lead-1', ...lead };
    }),
  } as unknown as Repository<SellerLeadEntity>;

  return { logged, saved, repository, service: new SellerLeadsService(repository, logger) };
}

describe('SellerLeadsService', () => {
  it('does not write the preferred name, email, or phone to the log', async () => {
    const { service, logged } = createHarness();

    await service.draft(enquiry);

    expect(logged.length).toBeGreaterThan(0);
    const output = JSON.stringify(logged);
    expect(output).not.toContain(enquiry.contact.preferredName);
    expect(output).not.toContain(enquiry.contact.email);
    expect(output).not.toContain(enquiry.contact.phone);
  });

  it('does not persist service consent with the draft enquiry', async () => {
    const { service, saved } = createHarness();

    await service.draft(enquiry);

    expect(saved).toHaveLength(1);
    expect(Object.keys(saved[0] ?? {})).not.toContain('serviceConsent');
    expect(JSON.stringify(saved[0])).not.toContain('serviceConsent');
  });

  it('saves the draft enquiry once with the captured contact', async () => {
    const { service, saved, repository } = createHarness();

    await service.draft(enquiry);

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(saved[0]).toMatchObject({
      profileId: enquiry.profileId,
      contact: {
        preferredName: enquiry.contact.preferredName,
        email: enquiry.contact.email,
        phone: enquiry.contact.phone,
      },
    });
  });
});
