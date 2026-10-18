import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSellerLeads1788220800000 implements MigrationInterface {
  name = 'CreateSellerLeads1788220800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seller_leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "profile_id" varchar NOT NULL,
        "contact" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "seller_leads"');
  }
}
