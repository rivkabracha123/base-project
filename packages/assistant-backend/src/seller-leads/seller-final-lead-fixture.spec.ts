import { houseRankingSchema, sellerFinalLeadFixture, sellerLeadSummarySchema, submitSellerLeadSchema } from '@monabid/shared';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses } from './house-rank';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

describe('prepared final-lead fixture', () => {
  it('traces confirmed item, catalog draft, valuation, and house choice into a P5 dashboard row', async () => {
    const fixture = sellerFinalLeadFixture;

    const handoff = submitSellerLeadSchema.parse(fixture.handoff);
    const ranking = houseRankingSchema.parse(rankActiveHouses(loadPreparedHouses(), fixture.item));

    expect(ranking.recommendation?.house.id).toBe(fixture.expectedRecommendationId);
    expect(ranking.recommendation?.house.active).toBe(true);
    expect(JSON.stringify(ranking)).not.toMatch(/commission|shipping|will accept/i);
    expect(JSON.stringify(handoff)).not.toMatch(/commission|will accept/i);

    const lead = {
      id: 'lead-synthetic-seller-1',
      profileId: fixture.request.profileId,
      contact: fixture.request.contact,
      recommendation: ranking,
      sellerChoice: {
        houseId: fixture.chosenHouseId,
        houseName: 'Kedem Auction House',
        source: 'seller' as const,
      },
      catalogDraft: handoff.catalogDraft,
      item: handoff.item,
      evidence: handoff.evidence,
      valuation: handoff.valuation,
      status: 'submitted' as const,
      history: [
        { at: '2026-01-01T00:00:00.000Z', event: 'submitted' as const, actor: 'seller' as const },
      ],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const list = jest.fn().mockResolvedValue([lead]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);
    const [row] = await controller.list();
    const summary = sellerLeadSummarySchema.parse(row);

    expect(summary.status).toBe('submitted');
    expect(summary.catalogDraft).toEqual(handoff.catalogDraft);
    expect(summary.item?.id).toBe('item-001');
    expect(summary.evidence?.[0]?.id).toBe('evidence-001');
    expect(summary.valuation?.status).toBe('supported');
    expect(summary.sellerChoice?.houseId).toBe(fixture.chosenHouseId);
    expect(summary.recommendation?.recommendation?.house.id).toBe(fixture.expectedRecommendationId);
    expect(summary.sellerChoice?.houseId).not.toBe(summary.recommendation?.recommendation?.house.id);
    expect(JSON.stringify(summary)).not.toMatch(/commission|will accept/i);
  });
});
