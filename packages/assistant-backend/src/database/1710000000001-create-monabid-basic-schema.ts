import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMonabidBasicSchema1710000000001
  implements MigrationInterface
{
  name = 'CreateMonabidBasicSchema1710000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sellers" (
        "id" varchar PRIMARY KEY,
        "anonymous_profile_id" varchar NOT NULL UNIQUE,
        "display_name" varchar NOT NULL,
        "preferred_name" varchar,
        "preferred_language" varchar NOT NULL DEFAULT 'he',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "seller_items" (
        "id" varchar PRIMARY KEY,
        "seller_id" varchar NOT NULL
          REFERENCES "sellers"("id") ON DELETE RESTRICT,
        "category" varchar NOT NULL,
        "title" varchar NOT NULL,
        "description_he" text,
        "description_en" text,
        "materials" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "dimensions" jsonb NOT NULL DEFAULT '{"values": []}'::jsonb,
        "width_cm" numeric(10, 2),
        "height_cm" numeric(10, 2),
        "dimension_unit" varchar NOT NULL DEFAULT 'cm',
        "dimension_confidence" varchar,
        "condition_description" text,
        "markings" text,
        "provenance" text,
        "era_guess" varchar,
        "status" varchar NOT NULL DEFAULT 'draft'
          CHECK ("status" IN ('draft', 'review', 'confirmed')),
        "source" varchar NOT NULL DEFAULT 'seller-intake',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "valid_item_dimensions" CHECK (
          ("dimensions" IS NULL OR jsonb_typeof("dimensions") = 'object')
          AND ("width_cm" IS NULL OR "width_cm" >= 0)
          AND ("height_cm" IS NULL OR "height_cm" >= 0)
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seller_items_seller_id"
      ON "seller_items"("seller_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_seller_items_status"
      ON "seller_items"("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "item_evidence" (
        "id" varchar PRIMARY KEY,
        "item_id" varchar NOT NULL
          REFERENCES "seller_items"("id") ON DELETE CASCADE,
        "evidence_type" varchar NOT NULL,
        "source" varchar NOT NULL,
        "uri" text,
        "evidence_value" text,
        "confidence" varchar,
        "caption_he" text,
        "caption_en" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_item_evidence_item_id"
      ON "item_evidence"("item_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "item_facts" (
        "id" varchar PRIMARY KEY,
        "item_id" varchar NOT NULL
          REFERENCES "seller_items"("id") ON DELETE CASCADE,
        "field_name" varchar NOT NULL,
        "fact_value" jsonb,
        "status" varchar NOT NULL
          CHECK ("status" IN (
            'confirmed',
            'uncertain',
            'unknown',
            'incomplete'
          )),
        "reason" text,
        "language" varchar,
        "confirmed_by" varchar,
        "confirmed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT "uq_item_fact"
          UNIQUE ("item_id", "field_name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_item_facts_item_id_status"
      ON "item_facts"("item_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "item_revisions" (
        "id" varchar PRIMARY KEY,
        "item_id" varchar NOT NULL
          REFERENCES "seller_items"("id") ON DELETE CASCADE,
        "actor" varchar NOT NULL
          CHECK ("actor" IN ('seller', 'assistant', 'system')),
        "summary" text NOT NULL,
        "changes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_item_revisions_item_id_created_at"
      ON "item_revisions"("item_id", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "item_revisions"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "item_facts"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "item_evidence"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "seller_items"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "sellers"
    `);
  }
}
