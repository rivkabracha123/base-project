import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve legacy rows while making their table compatible with the S5 entity. */
export class AlignLegacySellerLeads1788220800006 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "seller_leads" ADD COLUMN IF NOT EXISTS "profile_id" varchar, ADD COLUMN IF NOT EXISTS "contact" jsonb');
    if (await runner.hasColumn('seller_leads', 'seller_name')) {
      await runner.query(`UPDATE "seller_leads" SET "contact" = jsonb_strip_nulls(jsonb_build_object('preferredName', seller_name, 'email', email, 'phone', phone)) WHERE "contact" IS NULL`);
      await runner.query(`ALTER TABLE "seller_leads" ALTER COLUMN "seller_name" SET DEFAULT ''`);
    }
    if (await runner.hasColumn('seller_leads', 'item_title')) {
      await runner.query(`ALTER TABLE "seller_leads" ALTER COLUMN "item_title" SET DEFAULT ''`);
    }
    // Legacy rows have no anonymous ownership evidence; do not assign them to a visitor.
    await runner.query(`UPDATE "seller_leads" SET "profile_id" = 'legacy:' || "id"::text WHERE "profile_id" IS NULL`);
    await runner.query(`UPDATE "seller_leads" SET "contact" = '{}'::jsonb WHERE "contact" IS NULL`);
    await runner.query('ALTER TABLE "seller_leads" ALTER COLUMN "profile_id" SET NOT NULL, ALTER COLUMN "contact" SET NOT NULL');
    await runner.query('ALTER TABLE "seller_leads" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()');
  }

  async down(): Promise<void> {
    // Keep the additive compatibility fields to avoid discarding preserved contacts.
  }
}
