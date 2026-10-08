import { houseRankingSchema, type RankingItem } from '@monabid/shared';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses } from './house-rank';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

const successItem: RankingItem = {
  category: 'rare_books',
  geography: 'United States',
  preferredLanguage: 'en',
};

describe('prepared house-ranking fixture', () => {
  it('traces the named fixture through ranking into a dashboard-readable lead row', async () => {
    const ranking = houseRankingSchema.parse(rankActiveHouses(loadPreparedHouses(), successItem));

    expect(ranking.recommendation?.house.id).toBe('house-kestenbaum');

    const list = jest.fn().mockResolvedValue([
      {
        id: 'lead-synthetic-seller-1',
        profileId: 'profile-synthetic-seller-1',
        contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
        recommendation: ranking,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);
    const [row] = await controller.list();

    expect(row?.recommendation?.recommendation?.house.id).toBe('house-kestenbaum');
    expect(row?.recommendation?.recommendation?.house.active).toBe(true);
  });
});
