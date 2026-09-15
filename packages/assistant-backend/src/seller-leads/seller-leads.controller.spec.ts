import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

const enquiry = {
  profileId: 'profile-synthetic-1',
  contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
  serviceConsent: true,
} as CreateSellerLeadDto;

describe('SellerLeadsController', () => {
  it('creates a draft enquiry through the service and returns only its identifier', async () => {
    const draft = jest.fn().mockResolvedValue({
      id: 'lead-1',
      profileId: enquiry.profileId,
      contact: enquiry.contact,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const controller = new SellerLeadsController({ draft } as unknown as SellerLeadsService);

    await expect(controller.create(enquiry)).resolves.toEqual({ id: 'lead-1' });
    expect(draft).toHaveBeenCalledWith(enquiry);
  });

  it('exposes the draft enquiry route under the seller-leads path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SellerLeadsController)).toBe('seller-leads');
  });

  it('lists draft enquiries for the staff dashboard in the agreed shape', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'lead-1',
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        recommendation: null,
        sellerChoice: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);

    await expect(controller.list()).resolves.toEqual([
      {
        id: 'lead-1',
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        recommendation: null,
        sellerChoice: null,
        catalogDraft: null,
        item: null,
        evidence: null,
        valuation: null,
        status: 'draft',
        history: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('ranks active houses without storing a seller choice', () => {
    const ranking = {
      recommendation: {
        house: {
          id: 'house-kestenbaum',
          name: 'Kestenbaum & Company',
          active: true,
          categories: ['rare_books'],
          languages: ['en'],
          comparableSoldCountByCategory: { rare_books: 4 },
        },
        score: 1,
        reasons: ['Prepared house lists specialization in rare_books'],
      },
      alternatives: [],
      excluded: [],
    };
    const rankHouses = jest.fn().mockReturnValue(ranking);
    const controller = new SellerLeadsController({ rankHouses } as unknown as SellerLeadsService);

    expect(
      controller.rank({
        category: 'rare_books',
        geography: 'United States',
        preferredLanguage: 'en',
      }),
    ).toEqual(ranking);
    expect(rankHouses).toHaveBeenCalledWith(
      { category: 'rare_books', geography: 'United States', preferredLanguage: 'en' },
      undefined,
    );
    expect(JSON.stringify(ranking)).not.toContain('sellerChoice');
  });

  it('returns a privacy-limited dashboard detail for P5', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const get = jest.fn().mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      profileId: enquiry.profileId,
      contact: enquiry.contact,
      recommendation: null,
      sellerChoice: null,
      catalogDraft: { he: 'טיוטה', en: 'draft' },
      item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
      comparables: [{ id: 'comp-001', source: 'prepared-fixture' }],
      valuation: { status: 'refusal', reason: 'insufficient_evidence' },
      serviceConsent: true,
      status: 'submitted',
      history: [],
      createdAt,
      updatedAt: createdAt,
    });
    const controller = new SellerLeadsController({ get } as unknown as SellerLeadsService);
    const detail = await controller.get('11111111-1111-4111-8111-111111111111');

    expect(detail.leadId).toBe('11111111-1111-4111-8111-111111111111');
    expect(detail.contact.serviceConsent).toBe(true);
    expect(detail).not.toHaveProperty('profileId');
    expect(JSON.stringify(detail)).not.toMatch(/sessionId|marketingConsent|conversation/);
  });
});
