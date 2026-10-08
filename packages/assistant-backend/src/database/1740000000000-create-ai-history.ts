import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiHistory1740000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "ai_history" (
      "id" uuid PRIMARY KEY,
      "user_id" varchar NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
      "role" varchar NOT NULL CHECK ("role" IN ('buyer', 'seller')),
      "language" varchar NOT NULL CHECK ("language" IN ('he', 'en')),
      "prompt" text NOT NULL,
      "response" jsonb NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query('CREATE INDEX "idx_ai_history_user_date" ON "ai_history" ("user_id", "created_at" DESC, "id" DESC)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "ai_history"');
  }
}
