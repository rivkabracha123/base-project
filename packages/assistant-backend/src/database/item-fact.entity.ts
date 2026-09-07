import { Column, Entity, PrimaryColumn } from 'typeorm';

// Heni Cohen — confirmed facts: each fact is stored separately so uncertain
// information is never treated as confirmed.
@Entity({ name: 'item_facts' })
export class ItemFactEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'item_id', type: 'varchar' })
  itemId: string;

  @Column({ name: 'field_name', type: 'varchar' })
  fieldName: string;

  @Column({ name: 'fact_value', type: 'jsonb', nullable: true })
  factValue: unknown;

  @Column({ type: 'varchar' })
  status: 'confirmed' | 'uncertain' | 'unknown' | 'incomplete';

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  language: string | null;

  @Column({ name: 'confirmed_by', type: 'varchar', nullable: true })
  confirmedBy: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
