import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBuyerTables1710000000002 implements MigrationInterface {
  name = 'CreateBuyerTables1710000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Create buyer_requests table - stores original buyer messages
    await queryRunner.query(`
      CREATE TABLE "buyer_requests" (
        "id" varchar PRIMARY KEY,
        "profile_id" varchar NOT NULL,
        "original_message" text NOT NULL,
        "message_language" varchar DEFAULT 'unknown',
        "request_type" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_buyer_requests_profile" FOREIGN KEY ("profile_id") REFERENCES "anonymous_profiles"("id")
      )
    `);

    // Create buyer_criteria table - stores extracted structured criteria
    await queryRunner.query(`
      CREATE TABLE "buyer_criteria" (
        "id" varchar PRIMARY KEY,
        "profile_id" varchar NOT NULL,
        "budget_min" integer,
        "budget_max" integer,
        "category" varchar,
        "creator" varchar,
        "period" varchar,
        "location" varchar,
        "color" varchar,
        "notes" text[],
        "missing" text[],
        "next_question" varchar,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_buyer_criteria_profile" FOREIGN KEY ("profile_id") REFERENCES "anonymous_profiles"("id")
      )
    `);

    // Create buyer_conversations table - stores P4 responses and links to criteria
    await queryRunner.query(`
      CREATE TABLE "buyer_conversations" (
        "id" varchar PRIMARY KEY,
        "request_id" varchar NOT NULL,
        "p4_response" jsonb,
        "extracted_criteria_id" varchar,
        "response_timestamp" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_buyer_conversations_request" FOREIGN KEY ("request_id") REFERENCES "buyer_requests"("id"),
        CONSTRAINT "fk_buyer_conversations_criteria" FOREIGN KEY ("extracted_criteria_id") REFERENCES "buyer_criteria"("id")
      )
    `);

    // Create indexes for common queries
    await queryRunner.query(`CREATE INDEX "idx_buyer_requests_profile" ON "buyer_requests"("profile_id")`);
    await queryRunner.query(`CREATE INDEX "idx_buyer_criteria_profile" ON "buyer_criteria"("profile_id")`);
    await queryRunner.query(`CREATE INDEX "idx_buyer_conversations_request" ON "buyer_conversations"("request_id")`);
    await queryRunner.query(`CREATE INDEX "idx_buyer_conversations_criteria" ON "buyer_conversations"("extracted_criteria_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_buyer_conversations_criteria"');
    await queryRunner.query('DROP INDEX "idx_buyer_conversations_request"');
    await queryRunner.query('DROP INDEX "idx_buyer_criteria_profile"');
    await queryRunner.query('DROP INDEX "idx_buyer_requests_profile"');
    await queryRunner.query('DROP TABLE "buyer_conversations"');
    await queryRunner.query('DROP TABLE "buyer_criteria"');
    await queryRunner.query('DROP TABLE "buyer_requests"');
  }
}
