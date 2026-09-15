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
  const stored: SellerLeadEntity[] = [];
  const repository = {
    create: jest.fn((lead: Record<string, unknown>) => lead),
    save: jest.fn(async (lead: Record<string, unknown>) => {
      saved.push(lead);
      return { id: 'lead-1', ...lead };
    }),
    find: jest.fn(async () => [...stored]),
    findOneBy: jest.fn(async (where: { id: string }) => stored.find((lead) => lead.id === where.id) ?? null),
  } as unknown as Repository<SellerLeadEntity>;

  return { logged, saved, stored, repository, service: new SellerLeadsService(repository, logger) };
}

function draftLead(overrides: Partial<SellerLeadEntity> = {}): SellerLeadEntity {
  return {
    id: 'lead-1',
    profileId: enquiry.profileId,
    contact: enquiry.contact,
    recommendation: null,
    sellerChoice: null,
    catalogDraft: null,
    item: null,
    evidence: null,
    valuation: null,
    comparables: null,
    serviceConsent: true,
    status: 'draft',
    history: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
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

  it('persists service-contact consent for P5 but never marketing consent or consent in logs', async () => {
    const { service, saved, logged } = createHarness();

    await service.draft(enquiry);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ serviceConsent: true });
    expect(JSON.stringify(saved[0])).not.toMatch(/marketingConsent|sessionId/);
    expect(JSON.stringify(logged)).not.toContain('serviceConsent');
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

  it('lists the drafted enquiries newest first for the staff dashboard', async () => {
    const { service, stored, repository } = createHarness();
    stored.push(draftLead());

    await expect(service.list()).resolves.toEqual(stored);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('does not write the preferred name, email, or phone to the log when listing', async () => {
    const { service, stored, logged } = createHarness();
    stored.push(draftLead());

    await service.list();

    const output = JSON.stringify(logged);
    expect(output).not.toContain(enquiry.contact.preferredName);
    expect(output).not.toContain(enquiry.contact.email);
    expect(output).not.toContain(enquiry.contact.phone);
  });

  it('ranks prepared houses without writing contact details to the log', () => {
    const { service, logged } = createHarness();

    const ranking = service.rankHouses({
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    });

    expect(ranking.recommendation?.house.id).toBe('house-kestenbaum');
    expect(ranking.recommendation?.house.active).toBe(true);
    expect(JSON.stringify(ranking)).not.toMatch(/commission|shipping|acceptance|sellerChoice/i);
    const output = JSON.stringify(logged);
    expect(output).not.toContain(enquiry.contact.preferredName);
    expect(output).not.toContain(enquiry.contact.email);
    expect(output).not.toContain(enquiry.contact.phone);
  });

  it('stores ranking on an existing draft without replacing contact or inventing a seller choice', async () => {
    const { service, stored, saved } = createHarness();
    stored.push(draftLead());

    const ranking = service.rankHouses({ category: 'rare_books' });
    await service.attachRanking('lead-1', ranking);

    expect(saved.at(-1)).toMatchObject({
      id: 'lead-1',
      contact: enquiry.contact,
      recommendation: ranking,
    });
    expect(JSON.stringify(saved.at(-1))).not.toMatch(/"source":"seller"/);
  });

  it('saves an alternative house as seller choice without overwriting the recommendation', async () => {
    // S5 Week 4: Kedem is stored as sellerChoice; Kestenbaum remains the ranking; logs omit contact.
    const { service, stored, saved, logged } = createHarness();
    const ranking = service.rankHouses({
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    });
    stored.push(draftLead({ recommendation: ranking }));

    const updated = await service.saveSellerChoice('lead-1', 'house-kedem');

    expect(updated.recommendation?.recommendation?.house.id).toBe('house-kestenbaum');
    expect(updated.sellerChoice).toEqual({
      houseId: 'house-kedem',
      houseName: 'Kedem Auction House',
      source: 'seller',
    });
    expect(saved.at(-1)).toMatchObject({
      recommendation: ranking,
      sellerChoice: updated.sellerChoice,
    });
    const output = JSON.stringify(logged);
    expect(output).not.toContain(enquiry.contact.email);
  });

  it('rejects an inactive house as the seller choice', async () => {
    // S5 rule: recommend / choose only active prepared houses.
    const { service, stored } = createHarness();
    const ranking = service.rankHouses({ category: 'rare_books' });
    stored.push(draftLead({ recommendation: ranking }));

    await expect(service.saveSellerChoice('lead-1', 'house-inactive-demo')).rejects.toThrow(
      'Seller choice must be an active ranked house',
    );
  });

  const handoff = {
    catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
    item: {
      id: 'item-001',
      category: 'paintings',
      title: 'Abstract landscape study',
      evidenceIds: ['evidence-001'],
    },
    evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
    valuation: {
      status: 'supported' as const,
      reportId: 'valuation-001',
      valuationRange: { min: 800, max: 1200, currency: 'USD' as const },
    },
  };

  function rankedLead(overrides: Partial<SellerLeadEntity> = {}): SellerLeadEntity {
    const { service } = createHarness();
    const ranking = service.rankHouses({
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    });
    return draftLead({
      recommendation: ranking,
      sellerChoice: {
        houseId: 'house-kedem',
        houseName: 'Kedem Auction House',
        source: 'seller',
      },
      ...overrides,
    });
  }

  it('submits a final internal lead with catalog draft without contacting a house', async () => {
    const { service, stored, saved, logged } = createHarness();
    stored.push(rankedLead());

    const submitted = await service.submitFinal('lead-1', handoff);

    expect(submitted.status).toBe('submitted');
    expect(submitted.catalogDraft).toEqual(handoff.catalogDraft);
    expect(submitted.item?.evidenceIds).toEqual(['evidence-001']);
    expect(submitted.valuation?.status).toBe('supported');
    expect(submitted.sellerChoice?.houseId).toBe('house-kedem');
    expect(submitted.recommendation?.recommendation?.house.id).toBe('house-kestenbaum');
    expect(saved.at(-1)?.status).toBe('submitted');
    expect(JSON.stringify(saved.at(-1))).not.toMatch(/commission|will accept|smtp|mailto/i);
    const output = JSON.stringify(logged);
    expect(output).toContain('Submitted internal seller lead lead-1');
    expect(output).not.toContain(enquiry.contact.email);
    expect(output).not.toContain(enquiry.contact.preferredName);
  });

  it('rejects a final lead that is missing contact name and email or phone', async () => {
    const { service, stored } = createHarness();
    stored.push(rankedLead({ contact: { preferredName: '', email: undefined, phone: undefined } }));

    await expect(service.submitFinal('lead-1', handoff)).rejects.toThrow(
      'Lead requires a name and email or phone',
    );
  });

  it('rejects a final lead without a seller house choice', async () => {
    const { service, stored } = createHarness();
    stored.push(rankedLead({ sellerChoice: null }));

    await expect(service.submitFinal('lead-1', handoff)).rejects.toThrow(
      'Save a seller house choice before creating the final lead',
    );
  });

  it('rejects unsupported commission or acceptance claims on the catalog draft', async () => {
    const { service, stored } = createHarness();
    stored.push(rankedLead());

    await expect(
      service.submitFinal('lead-1', {
        ...handoff,
        catalogDraft: { he: 'עמלה 15%', en: 'We will accept 15% commission' },
      }),
    ).rejects.toThrow('Unsupported commission or acceptance claims');
  });

  it('does not attach a ranking when the draft enquiry is missing', async () => {
    const { service } = createHarness();
    const ranking = service.rankHouses({ category: 'rare_books' });

    await expect(service.attachRanking('missing-lead', ranking)).rejects.toThrow(
      'Seller lead missing-lead was not found',
    );
  });

  it('loads one lead by id for the P5 dashboard and 404s when missing', async () => {
    const { service, stored } = createHarness();
    stored.push(rankedLead({ id: '11111111-1111-4111-8111-111111111111' }));

    await expect(service.get('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
    });
    await expect(service.get('22222222-2222-4222-8222-222222222222')).rejects.toThrow(
      'Seller lead 22222222-2222-4222-8222-222222222222 was not found',
    );
  });
});
