import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { BuyerUnmatchedDemandDashboardView } from '../buyer/unmatched-demand-dashboard-view';

// One row per buyer lead: the latest no-result search recorded for staff, with no contact data.
@Entity({ name: 'buyer_unmatched_demand' })
export class BuyerUnmatchedDemandEntity {
  @PrimaryColumn({ name: 'lead_id', type: 'varchar' })
  leadId!: string;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ name: 'searched_at', type: 'timestamptz' })
  searchedAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: BuyerUnmatchedDemandDashboardView;
}
