import { Column, Entity, PrimaryColumn } from 'typeorm';

// Yael Sagis — photo references: evidence items are references, not storage or valuation logic.
@Entity({ name: 'item_evidence' })
export class ItemEvidenceEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'item_id', type: 'varchar' })
  itemId: string;

  @Column({ name: 'evidence_type', type: 'varchar' })
  evidenceType: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'text', nullable: true })
  uri: string | null;

  @Column({ name: 'evidence_value', type: 'text', nullable: true })
  evidenceValue: string | null;

  @Column({ type: 'varchar', nullable: true })
  confidence: string | null;

  @Column({ name: 'caption_he', type: 'text', nullable: true })
  captionHe: string | null;

  @Column({ name: 'caption_en', type: 'text', nullable: true })
  captionEn: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
