import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'anonymous_profiles' })
export class AnonymousProfileEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', unique: true })
  sessionId!: string;

  @Column({ name: 'preferred_language', type: 'varchar', default: 'he' })
  preferredLanguage!: string;

  @Column({ name: 'preferred_name', type: 'varchar', nullable: true })
  preferredName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ name: 'service_consent', type: 'boolean', default: false })
  serviceConsent!: boolean;

  @Column({ name: 'marketing_consent', type: 'boolean', default: false })
  marketingConsent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
