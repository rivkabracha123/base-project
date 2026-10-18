import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatConversations1790000000000 implements MigrationInterface {
  /**
   * Creates the single-row-per-conversation table and its profile lookup index.
   * יוצרת טבלה שבה כל שיחה נשמרת בשורה אחת, יחד עם אינדקס לאיתור שיחות לפי פרופיל.
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_conversations" (
        "id" uuid PRIMARY KEY,
        "user_id" varchar NOT NULL
          REFERENCES "user_profiles"("id") ON DELETE CASCADE,
        "role" varchar NOT NULL
          CHECK ("role" IN ('buyer', 'seller')),
        "language" varchar NOT NULL
          CHECK ("language" IN ('he', 'en')),
        "status" varchar NOT NULL DEFAULT 'active'
          CHECK ("status" IN ('active', 'completed')),
        "messages" jsonb NOT NULL DEFAULT '[]'::jsonb
          CHECK (jsonb_typeof("messages") = 'array'),
        "snapshot_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_chat_conversations_user_updated"
      ON "chat_conversations" ("user_id", "updated_at" DESC)
    `);
  }

  /**
   * Removes the chat table and index if this migration is reverted.
   * מסירה את טבלת השיחות ואת האינדקס אם מבטלים את המיגרציה.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_chat_conversations_user_updated"');
    await queryRunner.query('DROP TABLE "chat_conversations"');
  }
}
