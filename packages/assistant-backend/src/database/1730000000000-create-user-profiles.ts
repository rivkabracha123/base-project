import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserProfiles1730000000000 implements MigrationInterface {
  name = 'CreateUserProfiles1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" varchar PRIMARY KEY,
        "session_id" varchar NOT NULL UNIQUE,
        "language" varchar NOT NULL,
        "grammatical_form" varchar,
        "preferred_name" varchar,
        "email" varchar,
        "phone" varchar,
        "service_consent" jsonb NOT NULL,
        "marketing_consent" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_profiles"');
  }
}
