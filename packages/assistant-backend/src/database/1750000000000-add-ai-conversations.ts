import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiConversations1750000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_history" ADD COLUMN "conversation_id" uuid');
    // Old independent exchanges cannot safely be inferred to belong together.
    await queryRunner.query('UPDATE "ai_history" SET "conversation_id" = "id"');
    await queryRunner.query('ALTER TABLE "ai_history" ALTER COLUMN "conversation_id" SET NOT NULL');
    await queryRunner.query('CREATE INDEX "idx_ai_history_conversation" ON "ai_history" ("user_id", "conversation_id", "created_at", "id")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_history" DROP COLUMN "conversation_id"');
  }
}
