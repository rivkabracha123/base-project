import {
  appliedRelaxations,
  relaxCriteriaForSearch,
  relaxationOptions,
  type ApprovedRelaxation,
} from './approved-relaxation';
import type { BuyerCriteria } from './buyer-criteria';
import { BuyerSearchService } from './buyer-search.service';
import type { BuyerSearchOutcome } from '@monabid/shared';
import type { LotSearchResult } from '../lots/lot-match';
import type { SearchRequest } from './search-request';
import { createUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import type { BuyerSearchRequest } from './buyer-search-request';
import {
  buildDemandSummary,
  deriveHardConstraints,
  groupExplainedLots,
  type ExplainedLot,
} from './explained-results';
import { unmatchedDemandStore, type UnmatchedDemandRecorder } from './unmatched-demand.store';
import { resolveCategoryAlias } from '../lots/lot-alias';

export type { BuyerSearchOutcome };

// Canonical category token as the lots search matches it, so "ספרים נדירים" and "rare_books" compare equal.
function toCategoryToken(category: string): string {
  return resolveCategoryAlias(category) ?? category.trim().toLowerCase();
}

// Lots-search client; wired directly to LotsService.search() (no HTTP), so the client validates against the lots DTO itself.
export interface LotsSearchClient {
  search(request: SearchRequest): Promise<LotSearchResult>;
}

export interface BuyerSearchInput {
  criteria: BuyerCriteria;
  language: SearchRequest['language'];
  leadId: string;
  status: string;
  createdAt: string;
  searchedAt: string;
  // Lot the buyer picked from an earlier result set.
  selectedLotId?: string;
  // Filters the buyer explicitly agreed to drop for this search only; budget is never dropped without one.
  approvedRelaxations?: ApprovedRelaxation[];
}

// In-process progress notice, for a same-process caller (e.g. the criteria service) to relay onward; carries no lot data.
export type BuyerSearchProgress =
  | { stage: 'searching' }
  | { stage: 'results-found'; count: number }
  | { stage: 'no-results' }
  | { stage: 'insufficient-criteria' }
  | { stage: 'error' };

// Runs lots search, then returns grouped explained results, an honest recorded no-result, or a missing-criteria state.
export class BuyerSearchOrchestrator {
  // Takes the lots-search client, the request-building service, and where no-result demand is recorded.
  constructor(
    private readonly lotsSearch: LotsSearchClient,
    private readonly buyerSearch = new BuyerSearchService(),
    private readonly demandRecorder: UnmatchedDemandRecorder = unmatchedDemandStore,
  ) {}

  // Returns grouped explained results or a privacy-safe no-result view, criteria unchanged.
  // onProgress is optional and fires only in-process (e.g. for the criteria service to relay onward); it carries no lot data.
  search(
    input: BuyerSearchInput,
    onProgress?: (progress: BuyerSearchProgress) => void,
  ): Promise<BuyerSearchOutcome> {
    return this.run(input, onProgress, { excludedCategories: new Set<string>(), recordDemand: true });
  }

  // Searches the buyer's other criteria in every category except the requested ones; never records or resolves unmatched demand.
  searchOtherCategories(
    input: BuyerSearchInput,
    onProgress?: (progress: BuyerSearchProgress) => void,
  ): Promise<BuyerSearchOutcome> {
    const excludedCategories = new Set(input.criteria.categories.map(toCategoryToken));
    const criteria: BuyerCriteria = {
      ...input.criteria,
      categories: [],
      hardConstraints: input.criteria.hardConstraints.filter((constraint) => constraint.field !== 'categories'),
    };
    return this.run({ ...input, criteria }, onProgress, { excludedCategories, recordDemand: false });
  }

  // Shared search flow; drops lots in excluded categories and records or resolves no-result demand only when asked.
  private async run(
    input: BuyerSearchInput,
    onProgress: ((progress: BuyerSearchProgress) => void) | undefined,
    options: { excludedCategories: ReadonlySet<string>; recordDemand: boolean },
  ): Promise<BuyerSearchOutcome> {
    // A failing progress listener must never break the search itself.
    const notify = (progress: BuyerSearchProgress): void => {
      try {
        onProgress?.(progress);
      } catch {
        // Ignored on purpose: progress is advisory only.
      }
    };

    // The buyer's criteria and hard constraints stay as given; only this search's copy is relaxed.
    const fullRequest: BuyerSearchRequest = {
      criteria: input.criteria,
      language: input.language,
      hardConstraints:
        input.criteria.hardConstraints.length > 0
          ? input.criteria.hardConstraints
          : deriveHardConstraints(input.criteria),
    };
    const relaxed = appliedRelaxations(input.criteria, input.approvedRelaxations);
    const searchCriteria = relaxCriteriaForSearch(input.criteria, relaxed);
    const searchRequest = this.buyerSearch.createSearchRequest(searchCriteria, input.language);

    if (!searchRequest.query && !searchRequest.filters) {
      notify({ stage: 'insufficient-criteria' });
      return {
        kind: 'insufficient-criteria',
        searchRequest: fullRequest,
        selectedLotId: input.selectedLotId,
      };
    }

    notify({ stage: 'searching' });

    let items: ExplainedLot[];
    try {
      ({ data: items } = await this.lotsSearch.search(searchRequest));
      // A malformed response is a service failure, never an empty result that would record false demand.
      if (!Array.isArray(items)) throw new Error('Lots search returned no result list');
    } catch (error) {
      notify({ stage: 'error' });
      throw error;
    }
    if (options.excludedCategories.size > 0) {
      items = items.filter((entry) => !options.excludedCategories.has(toCategoryToken(entry.lot.category)));
    }

    if (items.length > 0) {
      // A refined search that now finds results closes the lead's earlier no-result demand.
      try {
        if (options.recordDemand) await this.demandRecorder.resolve(input.leadId);
      } catch (error) {
        notify({ stage: 'error' });
        throw error;
      }
      notify({ stage: 'results-found', count: items.length });
      return {
        kind: 'results',
        searchRequest: fullRequest,
        // Reasons come from the lots search as sent, so a relaxed filter is never claimed as matched.
        results: groupExplainedLots(items),
        approvedRefinements: relaxed,
        selectedLotId: input.selectedLotId,
      };
    }

    const view = createUnmatchedDemandDashboardView({
      id: input.leadId,
      status: input.status,
      createdAt: input.createdAt,
      searchedAt: input.searchedAt,
      searchRequest: fullRequest,
      demandSummary: buildDemandSummary(input.criteria, relaxed),
    });
    // No-result is reported only once the demand is saved; a failed save is a search error.
    try {
      if (options.recordDemand) await this.demandRecorder.record(view);
    } catch (error) {
      notify({ stage: 'error' });
      throw error;
    }
    notify({ stage: 'no-results' });
    return {
      kind: 'unmatched',
      view,
      relaxationOptions: relaxationOptions(searchCriteria),
      selectedLotId: input.selectedLotId,
    };
  }
}
