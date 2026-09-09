import type { HouseRanking } from '@monabid/shared';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface SellerLeadContact {
  preferredName: string;
  email?: string;
  phone?: string;
}

@Entity({ name: 'seller_leads' })
export class SellerLeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId: string;

  @Column({ type: 'jsonb' })
  contact: SellerLeadContact;

  @Column({ type: 'jsonb', nullable: true })
  recommendation: HouseRanking | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
