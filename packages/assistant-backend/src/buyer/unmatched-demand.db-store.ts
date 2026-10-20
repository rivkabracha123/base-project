import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import {
  latestSearchedAt,
  withFoundSearch,
  withNoResultSearch,
  type BuyerUnmatchedDemandDashboardView,
  type FoundLaterSearch,
} from './unmatched-demand-dashboard-view';
import type { UnmatchedDemandRecorder } from './unmatched-demand.store';

/** Database-backed unmatched-demand store keyed by lead id: the original request plus the buyer's latest later search, surviving restarts. */
@Injectable()
export class UnmatchedDemandDbStore implements UnmatchedDemandRecorder {
  // Takes the buyer_unmatched_demand repository.
  constructor(
    @InjectRepository(BuyerUnmatchedDemandEntity)
    private readonly repository: Repository<BuyerUnmatchedDemandEntity>,
  ) {}

  // Saves the first no-result view for its lead, or adds a later one as the lead's expansion.
  async record(view: BuyerUnmatchedDemandDashboardView): Promise<void> {
    await this.save(withNoResultSearch(await this.get(view.id), view));
  }

  // Marks the lead's recorded demand as found by a later search, if the lead has any.
  async recordFound(found: FoundLaterSearch): Promise<void> {
    const existing = await this.get(found.leadId);
    if (existing) await this.save(withFoundSearch(existing, found));
  }

  // Returns the recorded demand for one lead, if any.
  async get(leadId: string): Promise<BuyerUnmatchedDemandDashboardView | undefined> {
    const row = await this.repository.findOneBy({ leadId });
    return row?.payload;
  }

  // Writes one lead's view; the row's search time is the lead's most recent search.
  private async save(view: BuyerUnmatchedDemandDashboardView): Promise<void> {
    await this.repository.save({
      leadId: view.id,
      status: view.status,
      searchedAt: new Date(latestSearchedAt(view)),
      payload: view,
    });
  }

  // Returns every recorded demand, most recent search first.
  async list(): Promise<BuyerUnmatchedDemandDashboardView[]> {
    const rows = await this.repository.find({ order: { searchedAt: 'DESC' } });
    return rows.map((row) => row.payload);
  }
}
