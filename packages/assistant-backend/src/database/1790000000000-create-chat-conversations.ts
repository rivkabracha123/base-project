import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatConversations1790000000000 implements MigrationInterface {
  /**
   * Creates the chat table: one row per change (message_id) grouped by conversation_id.
   * יוצרת טבלה שבה כל שינוי בשיחה נשמר כשורה (message_id) תחת אותו מזהה שיחה, יחד עם אינדקס לאיתור שיחות לפי פרופיל.
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_conversations" (
        "message_id" uuid PRIMARY KEY,
        "conversation_id" uuid NOT NULL,
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

    // גרסה אחת בלבד לכל שיחה, כדי ששמירות כפולות לא ייצרו שורות כפולות.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_chat_conversations_conversation_version"
      ON "chat_conversations" ("conversation_id", "snapshot_version")
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
    await queryRunner.query('DROP INDEX IF EXISTS "idx_chat_conversations_conversation_version"');
    await queryRunner.query('DROP TABLE "chat_conversations"');
  }
}
