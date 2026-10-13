import type { SellerItemDraft } from '@monabid/shared';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'seller_intake_drafts' })
@Index(['profileId', 'sessionId'], { unique: true })
export class SellerIntakeDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId: string;

  @Column({ name: 'session_id', type: 'varchar' })
  sessionId: string;

  @Column({ type: 'jsonb' })
  draft: SellerItemDraft;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}