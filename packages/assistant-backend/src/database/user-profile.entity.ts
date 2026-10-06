import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { UserProfile } from '@monabid/shared';

@Entity({ name: 'user_profiles' })
export class UserProfileEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', unique: true })
  sessionId: string;

  @Column({ type: 'varchar' })
  language: string;

  @Column({ name: 'grammatical_form', type: 'varchar', nullable: true })
  grammaticalForm?: string;

  @Column({ name: 'preferred_name', type: 'varchar', nullable: true })
  preferredName?: string;

  @Column({ type: 'varchar', nullable: true })
  email?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ name: 'service_consent', type: 'jsonb' })
  serviceConsent: Record<string, unknown>;

  @Column({ name: 'marketing_consent', type: 'jsonb' })
  marketingConsent: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  toUserProfile(): UserProfile {
    return {
      id: this.id,
      sessionId: this.sessionId,
      language: this.language as 'he' | 'en',
      grammaticalForm: this.grammaticalForm
        ? (this.grammaticalForm as 'masculine' | 'feminine' | 'neutral' | 'unspecified')
        : undefined,
      preferredName: this.preferredName ?? null,
      email: this.email ?? null,
      phone: this.phone ?? null,
      serviceConsent: this.serviceConsent as any,
      marketingConsent: this.marketingConsent as any,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
