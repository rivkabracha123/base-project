import { Column, CreateDateColumn, UpdateDateColumn, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AnonymousProfileEntity } from './anonymous-profile.entity';

@Entity({ name: 'buyer_criteria' })
export class BuyerCriteriaEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId!: string;

  @ManyToOne(() => AnonymousProfileEntity)
  @JoinColumn({ name: 'profile_id' })
  profile!: AnonymousProfileEntity;

  @Column({ name: 'budget_min', type: 'integer', nullable: true })
  budgetMin?: number | null;

  @Column({ name: 'budget_max', type: 'integer', nullable: true })
  budgetMax?: number | null;

  @Column({ type: 'varchar', nullable: true })
  category?: string | null;

  @Column({ type: 'varchar', nullable: true })
  creator?: string | null;

  @Column({ type: 'varchar', nullable: true })
  period?: string | null;

  @Column({ type: 'varchar', nullable: true })
  location?: string | null;

  @Column({ type: 'varchar', nullable: true })
  color?: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  notes?: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  missing?: string[] | null;

  @Column({ name: 'next_question', type: 'varchar', nullable: true })
  nextQuestion?: string | null;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
