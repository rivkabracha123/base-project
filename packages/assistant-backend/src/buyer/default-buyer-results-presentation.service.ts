import { Injectable } from '@nestjs/common';
import type { ResultCardGroup } from './buyer-flow.types';
import type { ExplainedLot } from './explained-results';
import type {
  BuyerResultsPresentationPort,
  PresentSearchResultsInput,
  PresentSearchResultsResult,
} from './buyer-results-presentation.port';
import { BuyerSearchExecutionService } from './buyer-search-execution.service';
import type { BuyerSearchProgress } from './buyer-search.orchestrator';

const UNMATCHED_TEXT = {
  he: 'לא מצאנו פריטים שמתאימים לבקשה, בלי לרפות את המסננים.',
  en: 'No lots matched this request without relaxing your filters.',
} as const;

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

function progressText(count: number, language: 'he' | 'en'): string {
  return language === 'he'
    ? `מצאנו ${count} פריטים שמתאימים לבקשה.`
    : `Found ${count} lots that match this request.`;
}

/** Reference B4 until Batya's presentation service replaces this provider. */
@Injectable()
export class DefaultBuyerResultsPresentationService implements BuyerResultsPresentationPort {
  constructor(private readonly searchExecution: BuyerSearchExecutionService) {}

  async presentSearchResults(input: PresentSearchResultsInput): Promise<PresentSearchResultsResult> {
    const { searchContextId, criteria, onUpdate, selectedLotId } = input;
    const searchedAt = new Date().toISOString();

    onUpdate({ type: 'loading' });

    const relayProgress = (progress: BuyerSearchProgress): void => {
      if (progress.stage === 'searching') {
        onUpdate({ type: 'loading' });
        return;
      }
      if (progress.stage === 'results-found') {
        onUpdate({ type: 'progress', text: progressText(progress.count, criteria.language) });
        return;
      }
      if (progress.stage === 'error') {
        onUpdate({
          type: 'error',
          code: 'search_failed',
          text:
            criteria.language === 'he'
              ? 'החיפוש נכשל. נסו שוב בעוד רגע.'
              : 'Search failed. Please try again in a moment.',
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
      const text = UNMATCHED_TEXT[criteria.language];
      onUpdate({ type: 'unmatched', text });
      return { groups: [], outcome };
    }

    const groups = groupsFromResults(criteria, outcome.results.current, outcome.results.historical);
    onUpdate({ type: 'result_cards', groups });
    return { groups, outcome };
  }
}
