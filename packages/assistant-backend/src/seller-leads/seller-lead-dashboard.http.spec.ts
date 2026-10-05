import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { sellerLeadDashboardDetailFixture, sellerLeadDashboardDetailSchema } from '@monabid/shared';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { UserProfileEntity } from '../database/user-profile.entity';
import { SellerLeadsModule } from './seller-leads.module';

const FORBIDDEN = /profileId|sessionId|marketingConsent|conversation|signedUrl|file:\/\/|\\\\Users\\/i;

describe('SellerLeadsController dashboard detail (P5 contract)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const stored: SellerLeadEntity[] = [];
  const fixture = sellerLeadDashboardDetailFixture;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SellerLeadsModule],
    })
      .overrideProvider(getRepositoryToken(SellerLeadEntity))
      .useValue({
        find: jest.fn(async () => [...stored]),
        findOneBy: jest.fn(async (where: { id: string }) => stored.find((lead) => lead.id === where.id) ?? null),
        create: jest.fn((lead: SellerLeadEntity) => lead),
        save: jest.fn(async (lead: SellerLeadEntity) => lead),
      })
      .overrideProvider(getRepositoryToken(UserProfileEntity))
      .useValue({
        findOneBy: jest.fn(async () => null),
        create: jest.fn((row: Partial<UserProfileEntity>) => Object.assign(new UserProfileEntity(), row)),
        save: jest.fn(async (row: UserProfileEntity) => row),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  function storedLead(): SellerLeadEntity {
    const detail = fixture.dashboardDetail;
    return {
      id: fixture.leadId,
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: detail.contact.preferredName, email: detail.contact.email ?? undefined },
      recommendation: {
        recommendation: detail.recommendation,
        alternatives: detail.alternatives,
        excluded: [],
      },
      sellerChoice: detail.sellerChoice,
      catalogDraft: detail.catalogDraft,
      item: detail.item,
      evidence: [...(detail.evidence ?? []), { id: 'private-raw', type: 'photo', uri: 'file:///tmp/secret.jpg' } as never],
      comparables: detail.comparables,
      valuation: detail.valuation,
      serviceConsent: true,
      status: detail.status,
      history: detail.history,
      createdAt: new Date(detail.createdAt),
      updatedAt: new Date(detail.updatedAt),
    } as unknown as SellerLeadEntity;
  }

  it('GET /api/seller-leads/:leadId returns the privacy-limited dashboard DTO', async () => {
    stored.length = 0;
    stored.push(storedLead());

    const response = await fetch(`${baseUrl}/api/seller-leads/${fixture.leadId}`);
    expect(response.status).toBe(200);
    const body = sellerLeadDashboardDetailSchema.parse(await response.json());

    expect(body.leadId).toBe(fixture.leadId);
    expect(body.status).toBe('submitted');
    expect(body.item?.id).toBe('item-001');
    expect(body.evidence).toEqual([{ id: 'evidence-001', type: 'seller_statement' }, { id: 'private-raw', type: 'photo' }]);
    expect(body.evidence.some((row) => 'uri' in row)).toBe(false);
    expect(body.comparables).toEqual([{ id: 'comp-001', source: 'prepared-fixture' }]);
    expect(body.valuation?.status).toBe('supported');
    expect(body.valuation).toMatchObject({
      comparableCount: 1,
      confidence: { level: 'low' },
      limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
      comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
      excludedComparables: [],
      valuationRange: { min: 800, max: 1200, currency: 'USD' },
    });
    expect(body.recommendation?.house.id).toBe('house-kestenbaum');
    expect(body.alternatives[0]?.house.id).toBe('house-kedem');
    expect(body.sellerChoice?.houseId).toBe('house-kedem');
    expect(body.catalogDraft?.en).toBe('Abstract landscape study');
    expect(body.contact.serviceConsentGranted).toBe(true);
    expect(body.contact.email).toBe('synthetic.seller@example.test');
    expect(body.contact.phone).toBeNull();
    expect(body).not.toHaveProperty('profileId');
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
    expect(JSON.stringify(body)).not.toContain('file:///tmp/secret.jpg');
  });

  it('GET /api/seller-leads/:leadId nulls email and phone when service consent is not granted', async () => {
    stored.length = 0;
    stored.push({ ...storedLead(), serviceConsent: false });

    const response = await fetch(`${baseUrl}/api/seller-leads/${fixture.leadId}`);
    expect(response.status).toBe(200);
    const body = sellerLeadDashboardDetailSchema.parse(await response.json());
    expect(body.contact.serviceConsentGranted).toBe(false);
    expect(body.contact.email).toBeNull();
    expect(body.contact.phone).toBeNull();
    expect(body.contact.preferredName).toBe('Synthetic Seller');
  });

  it('GET /api/seller-leads/:leadId replaces unsafe comparable URLs with Source unavailable', async () => {
    stored.length = 0;
    const lead = storedLead();
    if (lead.valuation?.status === 'supported') {
      lead.valuation = {
        ...lead.valuation,
        comparables: [
          {
            id: 'comp-unsafe',
            source: { label: 'secret', url: 'file:///tmp/secret.jpg' },
          },
        ],
      };
    }
    stored.push(lead);

    const response = await fetch(`${baseUrl}/api/seller-leads/${fixture.leadId}`);
    const body = sellerLeadDashboardDetailSchema.parse(await response.json());
    expect(body.valuation && 'comparables' in body.valuation ? body.valuation.comparables : []).toEqual([
      { id: 'comp-unsafe', source: { label: 'Source unavailable', url: null } },
    ]);
    expect(JSON.stringify(body)).not.toContain('file:///tmp/secret.jpg');
  });

  it('GET /api/seller-leads/:leadId returns 404 when the lead is missing', async () => {
    stored.length = 0;
    const response = await fetch(`${baseUrl}/api/seller-leads/22222222-2222-4222-8222-222222222222`);
    expect(response.status).toBe(404);
  });

  it('GET /api/seller-leads/:leadId returns 400 when leadId is not a UUID', async () => {
    const response = await fetch(`${baseUrl}/api/seller-leads/not-a-uuid`);
    expect(response.status).toBe(400);
  });
});
