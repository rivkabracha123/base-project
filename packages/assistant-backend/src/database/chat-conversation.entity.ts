import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ChatConversationRole = 'buyer' | 'seller';
export type ChatConversationLanguage = 'he' | 'en';
export type ChatConversationStatus = 'active' | 'completed';

@Entity({ name: 'chat_conversations' })
export class ChatConversationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  role!: ChatConversationRole;

  @Column({ type: 'varchar' })
  language!: ChatConversationLanguage;

  @Column({ type: 'varchar', default: 'active' })
  status!: ChatConversationStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  messages!: Record<string, unknown>[];

  @Column({ name: 'snapshot_version', type: 'integer', default: 1 })
  snapshotVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
