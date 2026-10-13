import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { houseRankingSchema, sellerChoiceSchema, sellerLeadSummarySchema } from '@monabid/shared';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { UserProfileEntity } from '../database/user-profile.entity';
import { SellerLeadsModule } from './seller-leads.module';

describe('SellerLeadsController house ranking (contract)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const stored: SellerLeadEntity[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SellerLeadsModule],
    })
      .overrideProvider(getRepositoryToken(SellerLeadEntity))
      .useValue({
        find: jest.fn(async () => [...stored]),
        findOneBy: jest.fn(async (where: { id: string }) => stored.find((lead) => lead.id === where.id) ?? null),
        create: jest.fn((lead: SellerLeadEntity) => lead),
        save: jest.fn(async (lead: SellerLeadEntity) => {
          const saved = {
            ...lead,
            id: lead.id ?? 'lead-1',
            createdAt: lead.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: lead.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
          };
          const index = stored.findIndex((row) => row.id === saved.id);
          if (index >= 0) {
            stored[index] = saved as SellerLeadEntity;
          } else {
            stored.push(saved as SellerLeadEntity);
          }
          return saved;
        }),
      })
      .overrideProvider(getRepositoryToken(UserProfileEntity))
      .useValue({
        findOneBy: jest.fn(async () => null),
        create: jest.fn((row: Partial<UserProfileEntity>) => Object.assign(new UserProfileEntity(), row)),
        save: jest.fn(async (row: UserProfileEntity) => row),
      })
      .overrideProvider(getRepositoryToken(AuctionLotEntity))
      .useValue({ find: jest.fn(async () => []) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function postRanking(path: string, body: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json: unknown;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return { status: response.status, body: json };
  }

  it('POST /api/seller-leads/house-rankings returns a schema-conforming ranking from prepared houses', async () => {
    const response = await postRanking('/api/seller-leads/house-rankings', {
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    });

    expect(response.status).toBe(200);
    const ranking = houseRankingSchema.parse(response.body);
    expect(ranking.recommendation?.house.id).toBe('house-kestenbaum');
    expect(ranking.recommendation?.house.active).toBe(true);
    expect(ranking.excluded.map((row) => row.house.id)).toContain('house-inactive-demo');
  });

  it('stores the ranking on a draft lead for the dashboard consumer', async () => {
    stored.length = 0;
    stored.push({
      id: 'lead-1',
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
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
    } as SellerLeadEntity);

    const response = await postRanking('/api/seller-leads/lead-1/house-rankings', {
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    });

    expect(response.status).toBe(200);
    const ranking = houseRankingSchema.parse(response.body);
    expect(stored[0]?.recommendation?.recommendation?.house.id).toBe(ranking.recommendation?.house.id);

    const list = await fetch(`${baseUrl}/api/seller-leads`);
    const rows = (await list.json()) as Array<{ id: string; recommendation: unknown }>;
    expect(rows[0]?.id).toBe('lead-1');
    expect(houseRankingSchema.parse(rows[0]?.recommendation).recommendation?.house.active).toBe(true);
  });

  it('saves a seller override without changing the ranked recommendation', async () => {
    stored.length = 0;
    stored.push({
      id: 'lead-1',
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
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
    } as SellerLeadEntity);

    const item = {
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    };
    await postRanking('/api/seller-leads/lead-1/house-rankings', item);

    const choice = await postRanking('/api/seller-leads/lead-1/choice', { houseId: 'house-kedem' });
    expect(choice.status).toBe(200);
    expect(sellerChoiceSchema.parse(choice.body)).toEqual({
      houseId: 'house-kedem',
      houseName: 'Kedem Auction House',
      source: 'seller',
    });
    expect(stored[0]?.recommendation?.recommendation?.house.id).toBe('house-kestenbaum');
    expect(stored[0]?.sellerChoice?.houseId).toBe('house-kedem');
    expect(stored[0]?.sellerChoice?.houseId).not.toBe(
      stored[0]?.recommendation?.recommendation?.house.id,
    );

    const list = await fetch(`${baseUrl}/api/seller-leads`);
    const rows = (await list.json()) as Array<{ sellerChoice: unknown; recommendation: unknown }>;
    expect(sellerChoiceSchema.parse(rows[0]?.sellerChoice)).toEqual({
      houseId: 'house-kedem',
      houseName: 'Kedem Auction House',
      source: 'seller',
    });
    expect(houseRankingSchema.parse(rows[0]?.recommendation).recommendation?.house.id).toBe(
      'house-kestenbaum',
    );
  });

  it('submits a catalog draft as the final internal lead for the dashboard', async () => {
    stored.length = 0;
    stored.push({
      id: 'lead-1',
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
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
    });

    const item = {
      category: 'rare_books',
      geography: 'United States',
      preferredLanguage: 'en',
    };
    await postRanking('/api/seller-leads/lead-1/house-rankings', item);
    await postRanking('/api/seller-leads/lead-1/choice', { houseId: 'house-kedem' });

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
        status: 'refusal',
        reportId: 'valuation-refusal-001',
        reason: 'insufficient_evidence',
        comparableCount: 0,
        confidence: {
          level: 'low',
          explanation:
            'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
        },
        limitations: ['Insufficient sold comparables for a supported range.'],
        comparables: [],
        excludedComparables: [],
      },
    };
    const submitted = await postRanking('/api/seller-leads/lead-1/final', handoff);
    expect(submitted.status).toBe(200);
    const row = sellerLeadSummarySchema.parse(submitted.body);
    expect(row.status).toBe('submitted');
    expect(row.catalogDraft).toEqual(handoff.catalogDraft);
    expect(row.valuation?.status).toBe('refusal');
    expect(row.sellerChoice?.houseId).toBe('house-kedem');
    expect(row.recommendation?.recommendation?.house.id).toBe('house-kestenbaum');
    expect(row.history.map((entry) => entry.event)).toContain('submitted');
    expect(JSON.stringify(row)).not.toMatch(/commission|will accept/i);

    const list = await fetch(`${baseUrl}/api/seller-leads`);
    const rows = sellerLeadSummarySchema.array().parse(await list.json());
    expect(rows[0]?.status).toBe('submitted');
    expect(rows[0]?.catalogDraft?.en).toBe('Abstract landscape study');
  });

  it('POST /api/seller-leads/s1-handoff accepts S1 callback draft and returns ranking plus catalog', async () => {
    const response = await postRanking('/api/seller-leads/s1-handoff', {
      language: { preferred: 'he' },
      item: {
        id: 'item-001',
        category: 'paintings',
        title: 'Abstract landscape study',
        evidenceIds: ['evidence-001'],
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      },
      evidence: [{ id: 'evidence-001', type: 'seller_statement', uri: 'file:///secret.jpg' }],
      confirmedFacts: { category: 'paintings' },
      seller: { preferredName: 'Maya' },
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      ranking: { recommendation: { house: { active: boolean } } | null };
      catalogDraft: { en: string };
      evidence: Array<{ id: string; type: string }>;
      valuation: { status: string } | null;
    };
    expect(houseRankingSchema.parse(body.ranking).recommendation?.house.active).toBe(true);
    expect(body.catalogDraft.en).toBe('Abstract landscape study');
    expect(body.evidence).toEqual([{ id: 'evidence-001', type: 'seller_statement' }]);
    expect(JSON.stringify(body)).not.toMatch(/file:|Maya/i);
    expect(body.valuation === null || (body.valuation && typeof body.valuation.status === 'string')).toBe(true);
  });

  it('POST /api/seller-leads/enquiry ranks once then submits the internal lead', async () => {
    stored.length = 0;
    const handoff = {
      houseId: 'house-kedem',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
      catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      item: {
        id: 'item-001',
        category: 'paintings',
        title: 'Abstract landscape study',
        evidenceIds: ['evidence-001'],
      },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
      valuation: {
        status: 'refusal',
        reportId: 'valuation-refusal-001',
        reason: 'insufficient_evidence',
        comparableCount: 0,
        limitations: ['Insufficient sold comparables for a supported range.'],
        comparables: [],
        excludedComparables: [],
      },
    };
    const submitted = await postRanking('/api/seller-leads/enquiry', handoff);
    expect(submitted.status).toBe(200);
    const row = sellerLeadSummarySchema.parse(submitted.body);
    expect(row.status).toBe('submitted');
    expect(row.sellerChoice?.houseId).toBe('house-kedem');
    expect(row.recommendation?.recommendation?.house.id).toBe('house-judaica-specialist');
  });

  it('rejects a missing category with 400', async () => {
    const response = await postRanking('/api/seller-leads/house-rankings', {});
    expect(response.status).toBe(400);
  });
});
