import type { HouseRanking, PreparedAuctionHouse, RankedHouse, RankingItem } from '@monabid/shared';

const CATEGORY_POINTS = 4;
const GEOGRAPHY_POINTS = 2;
const LANGUAGE_POINTS = 1;
const COMPARABLE_POINTS_CAP = 3;
const RECENT_ACTIVITY_POINTS = 1;

const UNSUPPORTED_CLAIM =
  /commission|shipping|acceptance|will accept|consignment|guaranteed sale/i;

export function reasonIsSupported(reason: string): boolean {
  return !UNSUPPORTED_CLAIM.test(reason);
}

export function scorePreparedHouse(house: PreparedAuctionHouse, item: RankingItem): RankedHouse {
  if (!house.active) {
    return {
      house,
      score: 0,
      reasons: ['House is not marked active in prepared data'],
      exclusionReason: 'House is not marked active in prepared data',
    };
  }

  const reasons: string[] = [];
  let score = 0;

  if (house.categories.includes(item.category)) {
    score += CATEGORY_POINTS;
    reasons.push(`Prepared house lists specialization in ${item.category}`);
  } else {
    reasons.push(`Prepared house does not list ${item.category} as a specialization`);
  }

  if (item.geography && house.geography === item.geography) {
    score += GEOGRAPHY_POINTS;
    reasons.push(`Prepared house geography matches the item (${house.geography})`);
  }

  if (item.preferredLanguage && house.languages.includes(item.preferredLanguage)) {
    score += LANGUAGE_POINTS;
    reasons.push(`Prepared house lists language ${item.preferredLanguage}`);
  }

  const soldCount = house.comparableSoldCountByCategory[item.category] ?? 0;
  if (soldCount > 0) {
    const comparablePoints = Math.min(soldCount, COMPARABLE_POINTS_CAP);
    score += comparablePoints;
    reasons.push(
      `${soldCount} prepared realized sales recorded in ${item.category}`,
    );
  }

  if (house.recentSaleDate) {
    score += RECENT_ACTIVITY_POINTS;
    reasons.push(`Prepared recent sale activity on ${house.recentSaleDate}`);
  }

  if (reasons.length === 0) {
    reasons.push('Active prepared house with no additional matching evidence');
  }

  if (reasons.some((reason) => !reasonIsSupported(reason))) {
    throw new Error('Ranking produced an unsupported claim');
  }

  return { house, score, reasons };
}

function compareRanked(a: RankedHouse, b: RankedHouse): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return a.house.id.localeCompare(b.house.id);
}

export function rankActiveHouses(
  houses: PreparedAuctionHouse[],
  item: RankingItem,
): HouseRanking {
  const scored = houses.map((house) => scorePreparedHouse(house, item));
  const excluded = scored.filter((row) => row.exclusionReason);
  const included = scored.filter((row) => !row.exclusionReason).sort(compareRanked);

  const [recommendation = null, ...alternatives] = included;

  return { recommendation, alternatives, excluded };
}
