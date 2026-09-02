import { Column, CreateDateColumn, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AnonymousProfileEntity } from './anonymous-profile.entity';

@Entity({ name: 'buyer_requests' })
export class BuyerRequestEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId!: string;

  @ManyToOne(() => AnonymousProfileEntity)
  @JoinColumn({ name: 'profile_id' })
  profile!: AnonymousProfileEntity;

  @Column({ name: 'original_message', type: 'text' })
  originalMessage!: string;

  @Column({ name: 'message_language', type: 'varchar', default: 'unknown', nullable: true })
  messageLanguage?: string | null;

  @Column({ name: 'request_type', type: 'varchar', nullable: true })
  requestType?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
