import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'item_revisions' })
export class ItemRevisionEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'item_id', type: 'varchar' })
  itemId: string;

  @Column({ type: 'varchar' })
  actor: 'seller' | 'assistant' | 'system';

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  changes: string[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
