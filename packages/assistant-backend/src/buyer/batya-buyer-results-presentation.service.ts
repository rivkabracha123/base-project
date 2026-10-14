import { Injectable } from '@nestjs/common';
import type { ExplainedLot } from './explained-results';
import type { ResultCardGroup } from './buyer-flow.types';
import type {
  BuyerResultsPresentationPort,
  PresentSearchResultsInput,
  PresentSearchResultsResult,
} from './buyer-results-presentation.port';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import type { BuyerSearchProgress } from './buyer-search.orchestrator';
import { archiveStepText, searchingStepText, unfilteredStepText, upcomingStepText } from './buyer-search-steps';
import { LotsService } from '../lots/lots.service';
import type { PresentPriceTrendInput, PresentPriceTrendResult, PriceTrendPoint } from './buyer-results-presentation.port';

const UNMATCHED_TEXT = {
  he: 'לא נמצאו פריטים שמתאימים לבקשה בלי לוותר על המסננים.',
  en: 'No lots matched this request without relaxing your filters.',
} as const;

const NO_UPCOMING_TEXT = {
  he: 'אין כרגע פריטים קרובים למכירה שמתאימים לבקשה.',
  en: 'No upcoming lots match this request right now.',
} as const;

/**
 * B4's presentation boundary.
 *
 * B2 calls this service after Shilat chooses a search. B4 builds the B3 search
 * input, relays progress through B2's callback, and returns the full B3
 * outcome unchanged alongside display-only card groups.
 */
@Injectable()
export class BatyaBuyerResultsPresentationService implements BuyerResultsPresentationPort {
  constructor(
    private readonly searchExecution: BuyerSearchExecutionService,
    private readonly lots: LotsService,
  ) {}

  async presentSearchResults(input: PresentSearchResultsInput): Promise<PresentSearchResultsResult> {
    const { searchContextId, criteria, onUpdate, selectedLotId } = input;
    const searchedAt = new Date().toISOString();

    const relayProgress = (progress: BuyerSearchProgress): void => {
      // The buyer sees what is searched, and any requested detail the search cannot filter by.
      if (progress.stage === 'searching') {
        onUpdate({ type: 'loading', text: searchingStepText(criteria) });
        const unfiltered = unfilteredStepText(criteria);
        if (unfiltered) onUpdate({ type: 'progress', text: unfiltered });
      } else if (progress.stage === 'error') {
        onUpdate({
          type: 'error',
          code: 'search_failed',
          text: criteria.language === 'he' ? 'החיפוש נכשל. נסו שוב בעוד רגע.' : 'Search failed. Please try again in a moment.',
        });
      }
    };

    const outcome = await this.searchExecution.executeSearch(
      {
        criteria,
        language: criteria.language,
        leadId: searchContextId,
        status: 'new',
        createdAt: searchedAt,
        searchedAt,
        selectedLotId,
      },
      relayProgress,
    );

    if (outcome.kind === 'insufficient-criteria') {
      onUpdate({ type: 'error', code: 'insufficient_criteria', text: criteria.language === 'he' ? '\u05d7\u05e1\u05e8\u05d9\u05dd \u05e4\u05e8\u05d8\u05d9\u05dd \u05dc\u05d7\u05d9\u05e4\u05d5\u05e9.' : 'More search criteria are required.' });
      return { groups: [], outcome };
    }
    if (outcome.kind === 'unmatched') {
      onUpdate({ type: 'unmatched', text: UNMATCHED_TEXT[criteria.language] });
      return { groups: [], outcome };
    }

    const { current, historical } = outcome.results;
    const groups = groupsFromResults(criteria, current, []);
    if (groups.length > 0) {
      onUpdate({ type: 'progress', text: upcomingStepText(current.length, criteria.language) });
    }
    // Past sales are kept as price evidence rather than cards; the buyer is still told the archive was checked.
    if (historical.length > 0) {
      onUpdate({ type: 'progress', text: archiveStepText(historical.length, criteria.language) });
    }
    if (groups.length === 0) {
      onUpdate({ type: 'unmatched', text: historical.length > 0 ? NO_UPCOMING_TEXT[criteria.language] : UNMATCHED_TEXT[criteria.language] });
      return { groups, outcome };
    }
    onUpdate({ type: 'result_cards', groups });
    return { groups, outcome };
  }

  /**
   * Presents price evidence for the lots B3 has already selected as relevant.
   * It deliberately does not run a second similarity search.
   */
  async presentPriceTrend(input: PresentPriceTrendInput): Promise<PresentPriceTrendResult> {
    const uniqueIds = [...new Set(input.lots.map((lot) => lot.id))];
    const resolvedLots = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          return await this.lots.findOne(id);
        } catch {
          return null;
        }
      }),
    );
    const lots = resolvedLots.filter((lot): lot is NonNullable<typeof lot> => lot !== null);
    const firstCurrency = lots.find((lot) => lot.status === 'sold' && lot.realizedPrice)?.realizedPrice?.currency;
    const points: PriceTrendPoint[] = firstCurrency
      ? lots
          .filter((lot) => lot.status === 'sold' && lot.realizedPrice?.currency === firstCurrency)
          .sort((a, b) => a.saleDate.localeCompare(b.saleDate))
          .map((lot) => ({
            lotId: lot.id,
            saleDate: lot.saleDate,
            title: lot.title[input.language] ?? lot.title.en,
            price: lot.realizedPrice!,
          }))
      : [];

    const title = input.language === 'he' ? 'מגמת מחירים של פריטים מתאימים' : 'Price trend for matching lots';
    onPriceTrendUpdate(input, title, lots, points);
    return { lots, points };
  }
}

function onPriceTrendUpdate(
  input: PresentPriceTrendInput,
  title: string,
  lots: Awaited<ReturnType<LotsService['findOne']>>[],
  points: PriceTrendPoint[],
): void {
  input.onUpdate({ type: 'price_trend', title, lots, points });
}

function groupsFromResults(
  criteria: PresentSearchResultsInput['criteria'],
  current: ExplainedLot[],
  historical: ExplainedLot[],
): ResultCardGroup[] {
  const groups: ResultCardGroup[] = [];

  if (current.length > 0) {
    groups.push({
      title: criteria.language === 'he' ? 'מכירות קרובות' : 'Upcoming lots',
      items: current.map((entry) => ({ lot: entry.lot, matchReasons: entry.matchReasons })),
    });
  }

  if (historical.length > 0) {
    groups.push({
      title: criteria.language === 'he' ? 'מכירות קודמות' : 'Past sales',
      items: historical.map((entry) => ({ lot: entry.lot, matchReasons: entry.matchReasons })),
    });
  }

  return groups;
}

