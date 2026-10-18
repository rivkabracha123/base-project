import type {
  CatalogDraft,
  HouseRanking,
  SellerChoice,
  SellerLeadComparableRef,
  SellerLeadEvidence,
  SellerLeadHistoryEvent,
  SellerLeadItem,
  SellerLeadStatus,
  SellerLeadValuation,
} from '@monabid/shared';
import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** P3-shaped contact S5 stores on the internal enquiry (name + email or phone). */
export interface SellerLeadContact {
  preferredName: string;
  email?: string;
  phone?: string;
}

/** S5 seller enquiry row handed to P5 (contact, ranking, choice, catalog, valuation, history). */
@Entity({ name: 'seller_leads' })
export class SellerLeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar' })
  profileId: string;

  @Column({ type: 'jsonb' })
  contact: SellerLeadContact;

  /** S5 Week 3 ranked recommendation (reasons + alternatives). Never replaced by sellerChoice. */
  @Column({ type: 'jsonb', nullable: true })
  recommendation: HouseRanking | null;

  /** S5 Week 4 seller override. Separate column so the ranking stays intact for P5. */
  @Column({ name: 'seller_choice', type: 'jsonb', nullable: true })
  sellerChoice: SellerChoice | null;

  /** S5 Week 5: S1 bilingual catalog draft reviewed before the final internal lead. */
  @Column({ name: 'catalog_draft', type: 'jsonb', nullable: true })
  catalogDraft: CatalogDraft | null;

  @Column({ type: 'jsonb', nullable: true })
  item: SellerLeadItem | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence: SellerLeadEvidence[] | null;

  @Column({ type: 'jsonb', nullable: true })
  valuation: SellerLeadValuation | null;

  @Column({ name: 'enquiry_text', type: 'text', nullable: true })
  enquiryText?: string | null;

  /** Safe comparable refs copied onto the lead — S5 does not query S3/S4 tables for P5. */
  @Column({ type: 'jsonb', nullable: true })
  comparables: SellerLeadComparableRef[] | null;

  /** P3 service-contact consent only. Never marketing consent. */
  @Column({ name: 'service_consent', type: 'boolean', default: true })
  serviceConsent: boolean;

  /** draft until the seller submits; submitted is still internal — never a house contact. */
  @Column({ type: 'varchar', default: 'draft' })
  status: SellerLeadStatus;

  @Column({ type: 'jsonb', default: [] })
  history: SellerLeadHistoryEvent[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
