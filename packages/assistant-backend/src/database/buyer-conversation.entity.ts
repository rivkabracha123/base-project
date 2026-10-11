import { Column, CreateDateColumn, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BuyerRequestEntity } from './buyer-request.entity';
import { BuyerCriteriaEntity } from './buyer-criteria.entity';

@Entity({ name: 'buyer_conversations' })
export class BuyerConversationEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'request_id', type: 'varchar' })
  requestId!: string;

  @ManyToOne(() => BuyerRequestEntity)
  @JoinColumn({ name: 'request_id' })
  request!: BuyerRequestEntity;

  @Column({ name: 'p4_response', type: 'jsonb', nullable: true })
  p4Response?: Record<string, unknown> | null;

  @Column({ name: 'extracted_criteria_id', type: 'varchar', nullable: true })
  extractedCriteriaId?: string | null;

  @ManyToOne(() => BuyerCriteriaEntity, { nullable: true })
  @JoinColumn({ name: 'extracted_criteria_id' })
  extractedCriteria?: BuyerCriteriaEntity | null;

  @CreateDateColumn({ name: 'response_timestamp', type: 'timestamptz' })
  responseTimestamp!: Date;
}
