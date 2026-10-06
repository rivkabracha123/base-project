import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSellerIntakeDrafts1788220800005 implements MigrationInterface {
  name = 'CreateSellerIntakeDrafts1788220800005';

  // יוצר טבלת טיוטות S1 עם בידוד לפי פרופיל ושיחה ושמירת גרסאות.
  // Creates the S1 draft table with profile/session isolation and version tracking.
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "seller_intake_drafts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "profile_id" varchar NOT NULL,
        "session_id" varchar NOT NULL,
        "draft" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_seller_intake_drafts_profile_session" UNIQUE ("profile_id", "session_id")
      )
    `);
  }

  // מסיר את טבלת טיוטות S1 בעת ביטול המיגרציה.
  // Drops the S1 draft table when the migration is reverted.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "seller_intake_drafts"');
  }
}