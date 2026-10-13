import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuctionLot } from '@monabid/shared';
import { getBuyerCriteriaSession } from './buyer-criteria-session.store';
import {
  BUYER_RESULTS_PRESENTATION_PORT,
  type BuyerResultsPresentationPort,
} from './buyer-results-presentation.port';

export type BuyerSessionSearchGroup = {
  title: string;
  lots: AuctionLot[];
};

export type BuyerSessionSearchResponse =
  | { kind: 'results'; groups: BuyerSessionSearchGroup[] }
  | { kind: 'insufficient-criteria'; message: string }
  | { kind: 'unmatched'; message: string };

@Injectable()
export class BuyerSessionSearchService {
  constructor(
    @Inject(BUYER_RESULTS_PRESENTATION_PORT)
    private readonly presentation: BuyerResultsPresentationPort,
  ) {}

  async searchForSession(sessionId: string): Promise<BuyerSessionSearchResponse> {
    const session = getBuyerCriteriaSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Unknown buyer criteria session: ${sessionId}`);
    }

    const { groups, outcome } = await this.presentation.presentSearchResults({
      searchContextId: sessionId,
      criteria: session.criteria,
      onUpdate: () => {},
    });

    if (outcome.kind === 'insufficient-criteria') {
      return { kind: 'insufficient-criteria', message: session.criteria.language === 'he'
        ? '\u05d0\u05d9\u05dc\u05d5 \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u05d1\u05e8\u05e6\u05d5\u05e0\u05da \u05dc\u05d7\u05e4\u05e9?'
        : 'What items would you like to search for?' };
    }
    if (outcome.kind === 'unmatched') {
      return {
        kind: 'unmatched',
        message:
          session.criteria.language === 'he'
            ? 'לא מצאנו פריטים שמתאימים לבקשה, בלי לרפות את המסננים.'
            : 'No lots matched this request without relaxing your filters.',
      };
    }

    return {
      kind: 'results',
      groups: groups.map((group) => ({
        title: group.title,
        lots: group.items.map((item) => item.lot),
      })),
    };
  }
}
