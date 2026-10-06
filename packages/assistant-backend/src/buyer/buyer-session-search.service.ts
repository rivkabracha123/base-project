import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import { getBuyerCriteriaSession } from './buyer-criteria-session.store';
import { BuyerSearchOrchestrator, type LotsSearchClient } from './buyer-search.orchestrator';

export type BuyerSessionSearchGroup = {
  title: string;
  lots: AuctionLot[];
};

export type BuyerSessionSearchResponse =
  | { kind: 'results'; groups: BuyerSessionSearchGroup[] }
  | { kind: 'unmatched'; message: string };

@Injectable()
export class BuyerSessionSearchService {
  private readonly orchestrator: BuyerSearchOrchestrator;

  constructor(lotsSearch: LotsSearchClient) {
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
}
