import type { BuyerUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';

/** Where the orchestrator records no-result buyer demand so staff can read it later. */
export interface UnmatchedDemandRecorder {
  record(view: BuyerUnmatchedDemandDashboardView): void | Promise<void>;
  // Removes the lead's recorded demand once a later search for it finds results.
  resolve(leadId: string): void | Promise<void>;
}

/** In-memory unmatched-demand store keyed by lead id; the latest no-result search per lead wins. */
export class UnmatchedDemandStore implements UnmatchedDemandRecorder {
  private readonly views = new Map<string, BuyerUnmatchedDemandDashboardView>();

  // Saves the no-result view for its lead, replacing an earlier one for the same lead.
  record(view: BuyerUnmatchedDemandDashboardView): void {
    this.views.set(view.id, view);
  }

  // Removes the lead's recorded demand, if any.
  resolve(leadId: string): void {
    this.views.delete(leadId);
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
