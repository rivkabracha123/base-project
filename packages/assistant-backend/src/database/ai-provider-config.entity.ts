import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ai_provider_configs' })
export class AiProviderConfigEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  kind!: 'fixture' | 'real';

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'base_url', type: 'varchar', nullable: true })
  baseUrl?: string | null;

  @Column({ name: 'model_name', type: 'varchar', nullable: true })
  modelName?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
