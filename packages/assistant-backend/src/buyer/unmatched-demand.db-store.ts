import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BuyerUnmatchedDemandEntity } from '../database/buyer-unmatched-demand.entity';
import type { BuyerUnmatchedDemandDashboardView } from './unmatched-demand-dashboard-view';
import type { UnmatchedDemandRecorder } from './unmatched-demand.store';

/** Database-backed unmatched-demand store keyed by lead id; the latest no-result search per lead wins and survives restarts. */
@Injectable()
export class UnmatchedDemandDbStore implements UnmatchedDemandRecorder {
  // Takes the buyer_unmatched_demand repository.
  constructor(
    @InjectRepository(BuyerUnmatchedDemandEntity)
    private readonly repository: Repository<BuyerUnmatchedDemandEntity>,
  ) {}

  // Saves the no-result view for its lead, replacing an earlier one for the same lead.
  async record(view: BuyerUnmatchedDemandDashboardView): Promise<void> {
    await this.repository.save({
      leadId: view.id,
      status: view.status,
      searchedAt: new Date(view.unmatchedDemand.searchedAt),
      payload: view,
    });
  }

  // Removes the lead's recorded demand, if any.
  async resolve(leadId: string): Promise<void> {
    await this.repository.delete({ leadId });
  }

  // Returns the recorded demand for one lead, if any.
  async get(leadId: string): Promise<BuyerUnmatchedDemandDashboardView | undefined> {
    const row = await this.repository.findOneBy({ leadId });
    return row?.payload;
  }

  // Returns every recorded demand, most recent search first.
  async list(): Promise<BuyerUnmatchedDemandDashboardView[]> {
    const rows = await this.repository.find({ order: { searchedAt: 'DESC' } });
    return rows.map((row) => row.payload);
  }
}
