import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { AuctionLot } from '@monabid/shared';

@Entity({ name: 'auction_lots' })
export class AuctionLotEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ type: 'jsonb' })
  payload: AuctionLot;

  @Column({ name: 'source_provider', type: 'varchar' })
  sourceProvider: string;

  @Column({ name: 'source_record_id', type: 'varchar' })
  sourceRecordId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
