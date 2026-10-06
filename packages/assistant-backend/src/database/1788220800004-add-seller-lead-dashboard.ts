import type { MigrationInterface, QueryRunner } from 'typeorm';

/** S5: P5 dashboard detail needs updatedAt, serviceConsent, and copied comparable refs. */
export class AddSellerLeadDashboard1788220800004 implements MigrationInterface {
  name = 'AddSellerLeadDashboard1788220800004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      ADD COLUMN "comparables" jsonb,
      ADD COLUMN "service_consent" boolean NOT NULL DEFAULT true,
      ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      DROP COLUMN "updated_at",
      DROP COLUMN "service_consent",
      DROP COLUMN "comparables"
    `);
  }
}
