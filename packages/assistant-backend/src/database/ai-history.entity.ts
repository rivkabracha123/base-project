import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { AiRole, GenerateAiResponseDto } from '../ai/ai.dto';

@Entity({ name: 'ai_history' })
export class AiHistoryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  role!: AiRole;

  @Column({ type: 'varchar' })
  language!: 'he' | 'en';

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'jsonb' })
  response!: GenerateAiResponseDto;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
