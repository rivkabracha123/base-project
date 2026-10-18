import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBuyerUnmatchedDemand1740000000000 implements MigrationInterface {
  name = 'CreateBuyerUnmatchedDemand1740000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Buyer unmatched demand: latest no-result search per buyer lead, exposed to staff readers through UnmatchedDemandDbStore
    await queryRunner.query(`
      CREATE TABLE "buyer_unmatched_demand" (
        "lead_id" varchar PRIMARY KEY,
        "status" varchar NOT NULL,
        "searched_at" timestamptz NOT NULL,
        "payload" jsonb NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_buyer_unmatched_demand_searched_at" ON "buyer_unmatched_demand"("searched_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_buyer_unmatched_demand_searched_at"');
    await queryRunner.query('DROP TABLE "buyer_unmatched_demand"');
  }
}
