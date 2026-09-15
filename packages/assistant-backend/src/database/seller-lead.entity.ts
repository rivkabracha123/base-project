import type { HouseRanking, SellerChoice } from '@monabid/shared';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** P3-shaped contact S5 stores on the internal enquiry (name + email or phone). */
export interface SellerLeadContact {
  preferredName: string;
  email?: string;
  phone?: string;
}

/** S5 seller enquiry row handed to P5 (contact + ranking + optional sellerChoice). */
@Entity({ name: 'seller_leads' })
export class SellerLeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId: string;

  @Column({ type: 'jsonb' })
  contact: SellerLeadContact;

  /** S5 Week 3 ranked recommendation (reasons + alternatives). Never replaced by sellerChoice. */
  @Column({ type: 'jsonb', nullable: true })
  recommendation: HouseRanking | null;

  /** S5 Week 4 seller override. Separate column so the ranking stays intact for P5. */
  @Column({ name: 'seller_choice', type: 'jsonb', nullable: true })
  sellerChoice: SellerChoice | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
