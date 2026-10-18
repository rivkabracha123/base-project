import { NotFoundException, type LoggerService } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SellerLeadEntity } from '../database/seller-lead.entity';
import type { ProfilesService } from '../profiles/profiles.service';
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
      const row = { id: (lead.id as string | undefined) ?? 'lead-1', ...lead } as SellerLeadEntity;
      saved.push(lead);
      const index = stored.findIndex((entry) => entry.id === row.id);
      if (index >= 0) stored[index] = { ...stored[index], ...row };
      else stored.push(row);
      return row;
    }),
    find: jest.fn(async () => [...stored]),
    findOneBy: jest.fn(async (where: { id: string }) => stored.find((lead) => lead.id === where.id) ?? null),
  } as unknown as Repository<SellerLeadEntity>;

  // Fake ProfilesService: only profile 'profile-synthetic-1' belongs to 'session-1'.
  const profiles = {
    getOwnedProfileEntity: jest.fn(async (sessionId: string, profileId: string) => {
      if (sessionId === 'session-1' && profileId === 'profile-synthetic-1') return { id: profileId, sessionId };
      throw new NotFoundException('Profile not found');
    }),
    getOrCreateBySessionId: jest.fn(async (sessionId: string) => ({
      id: 'profile-synthetic-1',
      sessionId,
      language: 'he' as const,
      preferredName: enquiry.contact.preferredName,
      email: enquiry.contact.email ?? null,
      phone: enquiry.contact.phone ?? null,
      serviceConsent: { granted: true, grantedAt: '2026-09-01T00:00:00.000Z' },
      marketingConsent: { granted: false },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })),
  } as unknown as ProfilesService;

  return { logged, saved, stored, repository, logger, profiles, service: new SellerLeadsService(repository, logger, profiles) };
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

describe('SellerLeadsService ownership', () => {
  it('rejects a lead for a profile that does not belong to the session and saves nothing', async () => {
    const { service, repository } = createHarness();

    await expect(service.draft('session-other', enquiry)).rejects.toThrow(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not let another session rank or choose on an existing lead', async () => {
    const { service, stored, repository } = createHarness();
    stored.push({ id: 'lead-1', profileId: 'profile-synthetic-1', recommendation: null, sellerChoice: null } as SellerLeadEntity);

    await expect(service.attachRanking('session-other', 'lead-1', {} as never)).rejects.toThrow(NotFoundException);
    await expect(service.saveSellerChoice('session-other', 'lead-1', 'house-kedem')).rejects.toThrow(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('SellerLeadsService', () => {
  it('does not write the preferred name, email, or phone to the log', async () => {
    const { service, logged } = createHarness();

    await service.draft('session-1', enquiry);

    expect(logged.length).toBeGreaterThan(0);
    const output = JSON.stringify(logged);
    expect(output).not.toContain(enquiry.contact.preferredName);
    expect(output).not.toContain(enquiry.contact.email);
    expect(output).not.toContain(enquiry.contact.phone);
  });

  it('persists service-contact consent for P5 but never marketing consent or consent in logs', async () => {
    const { service, saved, logged } = createHarness();

    await service.draft('session-1', enquiry);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ serviceConsent: true });
    expect(JSON.stringify(saved[0])).not.toMatch(/marketingConsent|sessionId/);
    expect(JSON.stringify(logged)).not.toContain('serviceConsent');
  });

  it('saves the draft enquiry once with the captured contact', async () => {
    const { service, saved, repository } = createHarness();

    await service.draft('session-1', enquiry);

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

  it('copies profileId and contact from P3 when an anonymous session is present', async () => {
    const { saved, repository, logger } = createHarness();
    const profiles = {
      getOwnedProfileEntity: jest.fn(async () => ({ id: 'profile-from-p3', sessionId: 'sess-p3' })),
      getOrCreateBySessionId: jest.fn(async () => ({
        id: 'profile-from-p3',
        sessionId: 'sess-p3',
        language: 'he' as const,
        preferredName: 'P3 Seller',
        email: 'p3.seller@example.test',
        phone: null,
        serviceConsent: { granted: true, grantedAt: '2026-09-01T00:00:00.000Z' },
        marketingConsent: { granted: true },
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      })),
    };
    const service = new SellerLeadsService(repository, logger, profiles as never);

    await service.draft('sess-p3', { ...enquiry, profileId: 'profile-from-p3' });

    expect(profiles.getOrCreateBySessionId).toHaveBeenCalledWith('sess-p3');
    expect(saved[0]).toMatchObject({
      profileId: 'profile-from-p3',
      contact: {
        preferredName: 'P3 Seller',
        email: 'p3.seller@example.test',
      },
      serviceConsent: true,
    });
    expect(JSON.stringify(saved[0])).not.toMatch(/marketingConsent/);
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
    await service.attachRanking('session-1', 'lead-1', ranking);

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

    const updated = await service.saveSellerChoice('session-1', 'lead-1', 'house-kedem');

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

    await expect(service.saveSellerChoice('session-1', 'lead-1', 'house-inactive-demo')).rejects.toThrow(
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
      comparableCount: 1,
      confidence: {
        level: 'low' as const,
        explanation:
          'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
      },
      limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
      comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
      excludedComparables: [],
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

    await expect(service.attachRanking('session-1', 'missing-lead', ranking)).rejects.toThrow(
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

  it('returns live S4 valuation on S1 handoff without copying seller contact', async () => {
    const itemValuation = {
      calculateFromItem: jest.fn().mockResolvedValue({
        status: 'supported',
        reportId: 'live-s4-report',
        itemId: 'item-001',
        itemVersion: 'confirmed',
        calculationVersion: 'weighted-usd-population-sd-v1',
        comparableCount: 1,
        confidence: { level: 'medium', explanation: 'S4 confidence from comparable count.' },
        limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
        comparables: [
          {
            id: 'lot-1',
            source: 'demo',
            saleDate: '2024-03-10',
            originalPrice: 800,
            originalCurrency: 'USD',
            normalizedPrice: 800,
            weight: 1,
          },
        ],
        excludedComparables: [],
        valuationRange: { min: 700, max: 900, currency: 'USD' },
      }),
    };
    const { repository, logger } = createHarness();
    const service = new SellerLeadsService(repository, logger, undefined, itemValuation as never);

    const received = await service.receiveS1Handoff({
      language: { preferred: 'he' },
      item: {
        id: 'item-001',
        category: 'paintings',
        title: 'Abstract landscape study',
        evidenceIds: ['evidence-001'],
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
        materials: ['oil'],
      },
      evidence: [{ id: 'evidence-001', type: 'seller_statement', uri: 'file:///secret.jpg' }],
      confirmedFacts: { category: 'paintings' },
      seller: { preferredName: 'Maya' },
    });

    expect(itemValuation.calculateFromItem).toHaveBeenCalledWith({
      itemId: 'item-001',
      itemVersion: 'confirmed',
      item: { category: 'paintings' },
    });
    expect(received.valuation?.status).toBe('supported');
    expect(received.valuation && 'valuationRange' in received.valuation && received.valuation.valuationRange).toEqual({
      min: 700,
      max: 900,
      currency: 'USD',
    });
    expect(received.comparables).toEqual([{ id: 'lot-1', source: 'Source unavailable' }]);
    expect(JSON.stringify(received)).not.toMatch(/file:|Maya/i);
  });

  it('completes an internal enquiry with one persist path without contacting a house', async () => {
    const { service, stored, logged } = createHarness();

    const submitted = await service.completeEnquiry(
      {
        ...handoff,
        houseId: 'house-kedem',
        contact: enquiry.contact,
      },
      'session-1',
    );

    expect(submitted.status).toBe('submitted');
    expect(submitted.sellerChoice?.houseId).toBe('house-kedem');
    expect(submitted.recommendation?.recommendation?.house.id).toBe('house-judaica-specialist');
    expect(stored[0]?.status).toBe('submitted');
    expect(JSON.stringify(logged)).not.toContain(enquiry.contact.email);
  });
});

