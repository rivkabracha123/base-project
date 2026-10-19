import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerEnquiryText1788220800007 implements MigrationInterface {
  name = 'AddSellerEnquiryText1788220800007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "seller_leads" ADD COLUMN "enquiry_text" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "seller_leads" DROP COLUMN "enquiry_text"');
  }
}
