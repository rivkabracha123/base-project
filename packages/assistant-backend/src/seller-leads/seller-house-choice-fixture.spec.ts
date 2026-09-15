import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { houseRankingSchema, sellerChoiceSchema, type RankingItem } from '@monabid/shared';
import { loadPreparedHouses } from './house-rank-fixture';
import { rankActiveHouses } from './house-rank';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

const draftPath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json');

const choiceScenario = {
  item: {
    category: 'rare_books',
    geography: 'United States',
    preferredLanguage: 'en',
  } satisfies RankingItem,
  chosenHouseId: 'house-kedem',
  expectedRecommendationId: 'house-kestenbaum',
  expectedChoice: {
    houseId: 'house-kedem',
    houseName: 'Kedem Auction House',
    source: 'seller' as const,
  },
  s4ValuationOrRefusal: { ownedBy: 'S4', consumedNotOwned: true },
};

describe('prepared house-choice fixture', () => {
  it('traces P1 houses and an S1-shaped item through seller choice into a P5 dashboard row', async () => {
    const draft = JSON.parse(readFileSync(draftPath, 'utf8')) as {
      request: { profileId: string; contact: { preferredName: string; email?: string } };
    };

    expect(choiceScenario.s4ValuationOrRefusal.ownedBy).toBe('S4');
    expect(choiceScenario.s4ValuationOrRefusal.consumedNotOwned).toBe(true);

    const ranking = houseRankingSchema.parse(rankActiveHouses(loadPreparedHouses(), choiceScenario.item));
    const expectedChoice = sellerChoiceSchema.parse(choiceScenario.expectedChoice);

    expect(ranking.recommendation?.house.id).toBe(choiceScenario.expectedRecommendationId);
    expect(ranking.recommendation?.house.active).toBe(true);
    expect(JSON.stringify(ranking)).not.toMatch(/commission|shipping|will accept/i);

    const lead = {
      id: 'lead-synthetic-seller-1',
      profileId: draft.request.profileId,
      contact: draft.request.contact,
      recommendation: ranking,
      sellerChoice: expectedChoice,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const list = jest.fn().mockResolvedValue([lead]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);
    const [row] = await controller.list();

    expect(row?.recommendation?.recommendation?.house.id).toBe(choiceScenario.expectedRecommendationId);
    expect(row?.sellerChoice).toEqual(expectedChoice);
    expect(row?.sellerChoice?.houseId).toBe(choiceScenario.chosenHouseId);
    expect(row?.sellerChoice?.houseId).not.toBe(row?.recommendation?.recommendation?.house.id);
    expect(JSON.stringify(row)).not.toMatch(/commission|shipping|will accept/i);
  });
});
