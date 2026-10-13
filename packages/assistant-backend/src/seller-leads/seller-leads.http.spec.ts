import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { houseRankingSchema, sellerChoiceSchema } from '@monabid/shared';
import { SellerLeadEntity } from '../database/seller-lead.entity';
import { UserProfileEntity } from '../database/user-profile.entity';
import { LocalFileStorage } from '../storage/local-file-storage.service';
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
          const saved = { ...lead, id: lead.id ?? 'lead-1' };
          const index = stored.findIndex((row) => row.id === saved.id);
          if (index >= 0) {
            stored[index] = saved as SellerLeadEntity;
          } else {
            stored.push(saved as SellerLeadEntity);
          }
          return saved;
        }),
      })
      // Only profile-synthetic-seller-1 belongs to session-1; any other pair is not found.
      .overrideProvider(getRepositoryToken(UserProfileEntity))
      .useValue({
        findOneBy: jest.fn(async (where: { id: string; sessionId: string }) =>
          where.id === 'profile-synthetic-seller-1' && where.sessionId === 'session-1' ? { ...where } : null,
        ),
      })
      .overrideProvider(LocalFileStorage)
      .useValue({ deleteProfile: jest.fn() })
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

  async function postRanking(path: string, body: unknown, sessionId = 'session-1') {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-anonymous-session-id': sessionId },
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

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

  it('returns 404 when another session tries to rank or choose on the lead', async () => {
    stored.length = 0;
    stored.push({
      id: 'lead-1',
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
      recommendation: null,
      sellerChoice: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const item = { category: 'rare_books', geography: 'United States', preferredLanguage: 'en' };

    expect((await postRanking('/api/seller-leads/lead-1/house-rankings', item, 'session-other')).status).toBe(404);
    expect((await postRanking('/api/seller-leads/lead-1/choice', { houseId: 'house-kedem' }, 'session-other')).status).toBe(404);
    expect(stored[0]?.recommendation).toBeNull();
  });

  it('rejects a missing category with 400', async () => {
    const response = await postRanking('/api/seller-leads/house-rankings', {});
    expect(response.status).toBe(400);
  });
});
