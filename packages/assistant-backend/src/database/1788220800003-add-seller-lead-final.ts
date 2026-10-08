import type { MigrationInterface, QueryRunner } from 'typeorm';

/** S5 Week 5: persist catalog draft, item, evidence, valuation, status, and history for the final internal lead. */
export class AddSellerLeadFinal1788220800003 implements MigrationInterface {
  name = 'AddSellerLeadFinal1788220800003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      ADD COLUMN "catalog_draft" jsonb,
      ADD COLUMN "item" jsonb,
      ADD COLUMN "evidence" jsonb,
      ADD COLUMN "valuation" jsonb,
      ADD COLUMN "status" varchar NOT NULL DEFAULT 'draft',
      ADD COLUMN "history" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      DROP COLUMN "history",
      DROP COLUMN "status",
      DROP COLUMN "valuation",
      DROP COLUMN "evidence",
      DROP COLUMN "item",
      DROP COLUMN "catalog_draft"
    `);
  }
}
