import type { MigrationInterface, QueryRunner } from 'typeorm';

/** S5 Week 4: add seller_choice jsonb so the seller pick can persist without touching recommendation. */
export class AddSellerLeadChoice1788220800002 implements MigrationInterface {
  name = 'AddSellerLeadChoice1788220800002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      ADD COLUMN "seller_choice" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_leads"
      DROP COLUMN "seller_choice"
    `);
  }
}
