import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerLeadRecommendation1788220800001 implements MigrationInterface {
  name = 'AddSellerLeadRecommendation1788220800001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_enquiries"
      ADD COLUMN "recommendation" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "seller_enquiries"
      DROP COLUMN "recommendation"
    `);
  }
}
