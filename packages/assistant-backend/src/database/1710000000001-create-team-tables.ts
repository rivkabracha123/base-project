import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeamTables1710000000001 implements MigrationInterface {
  name = 'CreateTeamTables1710000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "anonymous_profiles" (
        "id" varchar PRIMARY KEY,
        "session_id" varchar NOT NULL UNIQUE,
        "preferred_language" varchar NOT NULL DEFAULT 'he',
        "preferred_name" varchar,
        "email" varchar,
        "phone" varchar,
        "service_consent" boolean NOT NULL DEFAULT false,
        "marketing_consent" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_provider_configs" (
        "id" varchar PRIMARY KEY,
        "name" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "base_url" varchar,
        "model_name" varchar,
        "settings" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "ai_provider_configs"');
    await queryRunner.query('DROP TABLE "anonymous_profiles"');
  }
}
