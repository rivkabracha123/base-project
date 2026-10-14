import {
  withFoundSearch,
  withNoResultSearch,
  type BuyerUnmatchedDemandDashboardView,
  type FoundLaterSearch,
} from './unmatched-demand-dashboard-view';

/** Where the orchestrator records no-result buyer demand so staff can read it later. */
export interface UnmatchedDemandRecorder {
  // Keeps the lead's first no-result request as the original; a later changed search becomes its expansion.
  record(view: BuyerUnmatchedDemandDashboardView): void | Promise<void>;
  // Marks the lead's recorded demand when a later search finds lots; does nothing for a lead with no demand.
  recordFound(found: FoundLaterSearch): void | Promise<void>;
}

/** In-memory unmatched-demand store keyed by lead id: the original request plus the buyer's latest later search. */
export class UnmatchedDemandStore implements UnmatchedDemandRecorder {
  private readonly views = new Map<string, BuyerUnmatchedDemandDashboardView>();

  // Saves the first no-result view for its lead, or adds a later one as the lead's expansion.
  record(view: BuyerUnmatchedDemandDashboardView): void {
    this.views.set(view.id, withNoResultSearch(this.views.get(view.id), view));
  }

  // Marks the lead's recorded demand as found by a later search, if the lead has any.
  recordFound(found: FoundLaterSearch): void {
    const existing = this.views.get(found.leadId);
    if (existing) this.views.set(found.leadId, withFoundSearch(existing, found));
  }

  // Returns the recorded demand for one lead, if any.
  get(leadId: string): BuyerUnmatchedDemandDashboardView | undefined {
    return this.views.get(leadId);
  }

  // Returns every recorded demand in insertion order.
  list(): BuyerUnmatchedDemandDashboardView[] {
    return [...this.views.values()];
  }

  // Clears all recorded demand (tests only).
  clear(): void {
    this.views.clear();
  }
}

/** Process-wide store shared by the orchestrator and staff readers. */
export const unmatchedDemandStore = new UnmatchedDemandStore();
