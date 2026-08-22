import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuctionLots1710000000000 implements MigrationInterface {
  name = 'CreateAuctionLots1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auction_lots" (
        "id" varchar PRIMARY KEY,
        "payload" jsonb NOT NULL,
        "source_provider" varchar NOT NULL,
        "source_record_id" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_auction_lot_source" UNIQUE ("source_provider", "source_record_id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auction_lots"');
  }
}
