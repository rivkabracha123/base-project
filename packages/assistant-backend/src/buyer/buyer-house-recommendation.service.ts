import { Injectable } from '@nestjs/common';
import type { BuyerCriteria, HouseRanking, RankingItem } from '@monabid/shared';
import { SellerLeadsService } from '../seller-leads/seller-leads.service';
import { BuyerCriteriaService } from './buyer-criteria.service';

/** AI function name for "which auction house specializes in this field" (registered on the seller side). */
export const RANK_HOUSES_FUNCTION = 'rankSellerHouses';

/** Answers the buyer's auction-house question by calling the existing seller-side house ranking. */
@Injectable()
export class BuyerHouseRecommendationService {
  constructor(
    private readonly sellerLeads: SellerLeadsService,
    private readonly criteriaService: BuyerCriteriaService,
  ) {}

  // Ranks prepared houses for the buyer's field; null when no category is known yet.
  recommend(sessionId: string, args?: Record<string, unknown> | null): HouseRanking | null {
    const item = toRankingItem(args ?? undefined, this.readCriteria(sessionId));
    return item ? keepSpecialists(this.sellerLeads.rankHouses(item), item.category) : null;
  }

  // Session criteria when the buyer already has a session, otherwise none.
  private readCriteria(sessionId: string): BuyerCriteria | undefined {
    try {
      return this.criteriaService.getCriteriaForSession(sessionId);
    } catch {
      return undefined;
    }
  }
}

// Keeps only ranked houses that list the field, in the seller ranking's order.
export function keepSpecialists(ranking: HouseRanking, category: string): HouseRanking {
  const ranked = ranking.recommendation ? [ranking.recommendation, ...ranking.alternatives] : ranking.alternatives;
  const [recommendation = null, ...alternatives] = ranked.filter((row) =>
    row.house.categories.includes(category),
  );
  return { recommendation, alternatives, excluded: ranking.excluded };
}

// Builds the ranking input from the AI arguments first, then from the latest session criteria.
export function toRankingItem(
  args: Record<string, unknown> | undefined,
  criteria: BuyerCriteria | undefined,
): RankingItem | null {
  const category = readText(args?.category) ?? lastText(criteria?.categories);
  if (!category) {
    return null;
  }

  const geography = readText(args?.geography) ?? lastText(criteria?.geography);
  const preferredLanguage = readText(args?.language) ?? readText(args?.preferredLanguage);

  return {
    category,
    ...(geography ? { geography } : {}),
    ...(preferredLanguage ? { preferredLanguage } : {}),
  };
}

// Trimmed string value or null.
function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// Latest non-empty entry of a criteria list (the field the buyer mentioned last).
function lastText(values: string[] | undefined): string | null {
  return [...(values ?? [])].reverse().map(readText).find((value): value is string => value !== null) ?? null;
}
