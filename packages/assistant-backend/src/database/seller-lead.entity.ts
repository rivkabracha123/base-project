import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'seller_leads' })
export class SellerLeadEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'seller_name', type: 'varchar' })
  sellerName!: string;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ name: 'item_title', type: 'varchar' })
  itemTitle!: string;

  @Column({ name: 'item_category', type: 'varchar', nullable: true })
  itemCategory?: string | null;

  @Column({ name: 'suggested_house', type: 'varchar', nullable: true })
  suggestedHouse?: string | null;

  @Column({ name: 'valuation_range', type: 'varchar', nullable: true })
  valuationRange?: string | null;

  @Column({ type: 'varchar', default: 'new' })
  status!: string;

  @Column({ type: 'boolean', default: false })
  consent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
