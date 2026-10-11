import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import type { BuyerChatMatchReason } from './buyer-chat-update';
import { getBuyerCriteriaSession } from './buyer-criteria-session.store';
import {
  BuyerSearchOrchestrator,
  type BuyerSearchInput,
  type LotsSearchClient,
} from './buyer-search.orchestrator';
import { LotsServiceSearchClient } from './lots-service-search.client';

export type BuyerSessionSearchGroup = {
  title: string;
  lots: AuctionLot[];
  // Reasons by lot id, as the search reported them; only the other-categories follow-up fills this.
  matchReasons?: Record<string, BuyerChatMatchReason[]>;
};

export type BuyerSessionSearchResponse =
  | { kind: 'results'; groups: BuyerSessionSearchGroup[] }
  | { kind: 'unmatched'; message: string };

/** Reply to the "similar items in other categories" follow-up. */
export type BuyerOtherCategoriesSearchResponse =
  | BuyerSessionSearchResponse
  | { kind: 'insufficient-criteria'; message: string }
  // The orchestrator in this build has no cross-category search yet.
  | { kind: 'unavailable' };

// One result as the chat reads it: the lot and the reasons the search reported for it.
type OtherCategoriesEntry = { lot: AuctionLot; matchReasons?: BuyerChatMatchReason[] };

/** What the chat reads from BuyerSearchOrchestrator.searchOtherCategories; the orchestrator owns the full outcome. */
export type OtherCategoriesSearchOutcome =
  | { kind: 'results'; results: { current: OtherCategoriesEntry[]; historical: OtherCategoriesEntry[] } }
  | { kind: 'unmatched' }
  | { kind: 'insufficient-criteria' };

interface OtherCategoriesSearch {
  searchOtherCategories(input: BuyerSearchInput): Promise<OtherCategoriesSearchOutcome>;
}

// Builds one chat group from search entries, keeping the reported reasons for the lots that have any.
function toOtherCategoriesGroup(title: string, entries: OtherCategoriesEntry[]): BuyerSessionSearchGroup {
  const matchReasons: Record<string, BuyerChatMatchReason[]> = {};
  for (const entry of entries) {
    if (entry.matchReasons && entry.matchReasons.length > 0) {
      matchReasons[entry.lot.id] = entry.matchReasons.map(({ field, detail }) => ({ field, detail }));
    }
  }
  return {
    title,
    lots: entries.map((entry) => entry.lot),
    ...(Object.keys(matchReasons).length > 0 ? { matchReasons } : {}),
  };
}

// True once the orchestrator provides the cross-category search; drop this check when it always does.
function canSearchOtherCategories(orchestrator: object): orchestrator is OtherCategoriesSearch {
  return 'searchOtherCategories' in orchestrator && typeof orchestrator.searchOtherCategories === 'function';
}

@Injectable()
export class BuyerSessionSearchService {
  private readonly orchestrator: BuyerSearchOrchestrator;

  // An interface does not exist at runtime, so Nest cannot inject it by type; inject by the class token instead
  // while keeping the interface type so tests can pass any LotsSearchClient.
  constructor(@Inject(LotsServiceSearchClient) lotsSearch: LotsSearchClient) {
    this.orchestrator = new BuyerSearchOrchestrator(lotsSearch);
  }

  async searchForSession(sessionId: string): Promise<BuyerSessionSearchResponse> {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }

    const criteria = session.criteria;
    const searchedAt = new Date().toISOString();
    const outcome = await this.orchestrator.search({
      criteria,
      language: criteria.language,
      leadId: sessionId,
      status: 'new',
      createdAt: searchedAt,
      searchedAt,
    });

    if (outcome.kind === 'unmatched') {
      return {
        kind: 'unmatched',
        message:
          criteria.language === 'he'
            ? 'לא מצאנו פריטים שמתאימים לבקשה, בלי לרפות את המסננים.'
            : 'No lots matched this request without relaxing your filters.',
      };
    }

    const { current, historical } = outcome.results;
    const groups: BuyerSessionSearchGroup[] = [];
    if (current.length > 0) {
      groups.push({
        title: criteria.language === 'he' ? 'מכירות קרובות' : 'Upcoming lots',
        lots: current.map((entry) => entry.lot),
      });
    }
    if (historical.length > 0) {
      groups.push({
        title: criteria.language === 'he' ? 'מכירות קודמות' : 'Past sales',
        lots: historical.map((entry) => entry.lot),
      });
    }

    return { kind: 'results', groups };
  }

  // Follow-up "similar items in other categories": hands the session's full criteria, category included, to the
  // orchestrator, which owns the cross-category search. Nothing is filtered or searched here.
  async searchOtherCategoriesForSession(sessionId: string): Promise<BuyerOtherCategoriesSearchResponse> {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }

    const orchestrator = this.orchestrator;
    if (!canSearchOtherCategories(orchestrator)) {
      return { kind: 'unavailable' };
    }

    const criteria = session.criteria;
    const searchedAt = new Date().toISOString();
    const outcome = await orchestrator.searchOtherCategories({
      criteria,
      language: criteria.language,
      leadId: sessionId,
      status: 'new',
      createdAt: searchedAt,
      searchedAt,
    });

    if (outcome.kind === 'unmatched') {
      return {
        kind: 'unmatched',
        message:
          criteria.language === 'he'
            ? 'לא מצאנו פריטים דומים בתחומים אחרים.'
            : 'No similar lots were found in other categories.',
      };
    }

    if (outcome.kind === 'insufficient-criteria') {
      return {
        kind: 'insufficient-criteria',
        message:
          criteria.language === 'he'
            ? 'כדי לחפש בתחומים אחרים צריך פרט נוסף מעבר לתחום, למשל יוצר, תקופה או תקציב.'
            : 'To search other categories we need one more detail besides the category, such as a creator, period, or budget.',
      };
    }

    const { current, historical } = outcome.results;
    const groups: BuyerSessionSearchGroup[] = [];
    if (current.length > 0) {
      groups.push(toOtherCategoriesGroup(criteria.language === 'he' ? 'מכירות קרובות' : 'Upcoming lots', current));
    }
    if (historical.length > 0) {
      groups.push(toOtherCategoriesGroup(criteria.language === 'he' ? 'מכירות קודמות' : 'Past sales', historical));
    }

    return { kind: 'results', groups };
  }
}
