import { Column, Entity, PrimaryColumn } from 'typeorm';

// Generalized dimension list: labels are intentionally open-ended,
// for example width, height, depth, diameter, circumference, weight, etc.
export interface SellerItemDimensions {
  values: Array<{ label: string; value: number; unit: string }>;
  [key: string]: unknown;
}

@Entity({ name: 'seller_items' })
export class SellerItemEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'seller_id', type: 'varchar' })
  sellerId: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ name: 'description_he', type: 'text', nullable: true })
  descriptionHe: string | null;

  @Column({ name: 'description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  materials: string[];

  @Column({ type: 'jsonb', default: () => `'{"values": []}'::jsonb` })
  dimensions: SellerItemDimensions;

  @Column({ name: 'width_cm', type: 'numeric', precision: 10, scale: 2, nullable: true })
  widthCm: number | null;

  @Column({ name: 'height_cm', type: 'numeric', precision: 10, scale: 2, nullable: true })
  heightCm: number | null;

  @Column({ name: 'dimension_unit', type: 'varchar', default: 'cm' })
  dimensionUnit: string;

  @Column({ name: 'dimension_confidence', type: 'varchar', nullable: true })
  dimensionConfidence: string | null;

  @Column({ name: 'condition_description', type: 'text', nullable: true })
  conditionDescription: string | null;

  @Column({ type: 'text', nullable: true })
  markings: string | null;

  @Column({ type: 'text', nullable: true })
  provenance: string | null;

  @Column({ name: 'era_guess', type: 'varchar', nullable: true })
  eraGuess: string | null;

  @Column({ type: 'varchar', default: 'draft' })
  status: 'draft' | 'review' | 'confirmed';

  @Column({ type: 'varchar', default: 'seller-intake' })
  source: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
