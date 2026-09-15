import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { sellerLeadDashboardDetailSchema } from '@monabid/shared';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { SellerLeadsModule } from './seller-leads.module';

const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-lead-dashboard-detail.json');
const FORBIDDEN = /profileId|sessionId|marketingConsent|conversation|signedUrl|file:\/\/|\\\\Users\\/i;

describe('SellerLeadsController dashboard detail (P5 contract)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const stored: SellerLeadEntity[] = [];
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    leadId: string;
    dashboardDetail: {
      leadId: string;
      status: 'submitted';
      createdAt: string;
      updatedAt: string;
      item: SellerLeadEntity['item'];
      evidence: SellerLeadEntity['evidence'];
      comparables: SellerLeadEntity['comparables'];
      valuation: SellerLeadEntity['valuation'];
      recommendation: NonNullable<SellerLeadEntity['recommendation']>['recommendation'];
      alternatives: NonNullable<SellerLeadEntity['recommendation']>['alternatives'];
      sellerChoice: SellerLeadEntity['sellerChoice'];
      catalogDraft: SellerLeadEntity['catalogDraft'];
      contact: { preferredName: string; email?: string; serviceConsent: boolean };
      history: SellerLeadEntity['history'];
    };
  };

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
      contact: { preferredName: detail.contact.preferredName, email: detail.contact.email },
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
    } as SellerLeadEntity;
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
    expect(body.recommendation?.house.id).toBe('house-kestenbaum');
    expect(body.alternatives[0]?.house.id).toBe('house-kedem');
    expect(body.sellerChoice?.houseId).toBe('house-kedem');
    expect(body.catalogDraft?.en).toBe('Abstract landscape study');
    expect(body.contact.serviceConsent).toBe(true);
    expect(body).not.toHaveProperty('profileId');
    expect(JSON.stringify(body)).not.toMatch(FORBIDDEN);
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
