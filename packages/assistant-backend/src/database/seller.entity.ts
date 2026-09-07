import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sellers' })
export class SellerEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'anonymous_profile_id', type: 'varchar', unique: true })
  anonymousProfileId: string;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName: string;

  @Column({ name: 'preferred_name', type: 'varchar', nullable: true })
  preferredName: string | null;

  @Column({ name: 'preferred_language', type: 'varchar', default: 'he' })
  preferredLanguage: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
