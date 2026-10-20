import 'reflect-metadata';
import type { QueryRunner } from 'typeorm';
import type { ConfigService } from '@nestjs/config';

// AppModule validates configuration eagerly through ConfigModule.forRoot at import
// time, so the committed .env.example values are supplied before it is loaded.
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.DATABASE_URL ??= 'postgresql://monabid:monabid@localhost:5432/monabid';

const config = {
  getOrThrow: () => 'postgresql://monabid:monabid@localhost:5432/monabid',
} as unknown as ConfigService;

describe('seller lead schema', () => {
  it('registers the seller lead migration with the application data source', async () => {
    const { databaseOptions } = await import('../app.module');
    const { CreateSellerLeads1788220800000 } = await import('./1788220800000-create-seller-leads');

    expect(databaseOptions(config).migrations).toContain(CreateSellerLeads1788220800000);
  });

  it('registers the P3 user_profiles entity and migration so S5 can call GET /api/profiles/me', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { UserProfileEntity } = await import('./user-profile.entity');
    const { CreateUserProfiles1730000000000 } = await import('./1730000000000-create-user-profiles');

    expect(databaseOptions(config).entities).toContain(UserProfileEntity);
    expect(databaseOptions(config).migrations).toContain(CreateUserProfiles1730000000000);
    expect(AppDataSource.options.entities).toContain(UserProfileEntity);
    expect(AppDataSource.options.migrations).toContain(CreateUserProfiles1730000000000);
  });

  it('does not create a duplicate legacy seller_leads table in the Team1 bootstrap migration', async () => {
    const { CreateTeamTables1710000000001 } = await import('./1710000000001-create-team-tables');
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => { queries.push(sql); } } as unknown as QueryRunner;

    await new CreateTeamTables1710000000001().up(queryRunner);

    expect(queries.join('\n')).toContain('CREATE TABLE "anonymous_profiles"');
    expect(queries.join('\n')).toContain('CREATE TABLE "ai_provider_configs"');
    expect(queries.join('\n')).not.toContain('CREATE TABLE "seller_leads"');
  });

  it('registers the seller lead entity and migration with the migration CLI data source', async () => {
    const { default: AppDataSource } = await import('./data-source');
    const { SellerLeadEntity } = await import('./seller-lead.entity');
    const { CreateSellerLeads1788220800000 } = await import('./1788220800000-create-seller-leads');

    expect(AppDataSource.options.entities).toContain(SellerLeadEntity);
    expect(AppDataSource.options.migrations).toContain(CreateSellerLeads1788220800000);
  });

  it('creates and drops the seller_leads table', async () => {
    const { CreateSellerLeads1788220800000 } = await import('./1788220800000-create-seller-leads');

    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;

    const migration = new CreateSellerLeads1788220800000();

    await migration.up(queryRunner);
    const [createTable] = queries;
    expect(createTable).toContain('CREATE TABLE IF NOT EXISTS "seller_leads"');
    expect(createTable).toContain('"profile_id"');
    expect(createTable).toContain('"contact" jsonb');
    expect(createTable).toContain('"created_at"');
    expect(createTable).not.toContain('consent');
    expect(createTable).not.toContain('status');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP TABLE "seller_leads"');
  });

  it('registers the recommendation column migration', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { AddSellerLeadRecommendation1788220800001 } = await import(
      './1788220800001-add-seller-lead-recommendation'
    );

    expect(databaseOptions(config).migrations).toContain(AddSellerLeadRecommendation1788220800001);
    expect(AppDataSource.options.migrations).toContain(AddSellerLeadRecommendation1788220800001);
  });

  it('adds and drops the recommendation column', async () => {
    const { AddSellerLeadRecommendation1788220800001 } = await import(
      './1788220800001-add-seller-lead-recommendation'
    );

    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;

    const migration = new AddSellerLeadRecommendation1788220800001();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "recommendation" jsonb');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "recommendation"');
  });

  it('registers the seller-choice column migration', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { AddSellerLeadChoice1788220800002 } = await import('./1788220800002-add-seller-lead-choice');

    expect(databaseOptions(config).migrations).toContain(AddSellerLeadChoice1788220800002);
    expect(AppDataSource.options.migrations).toContain(AddSellerLeadChoice1788220800002);
  });

  it('registers the final-lead column migration', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { AddSellerLeadFinal1788220800003 } = await import('./1788220800003-add-seller-lead-final');

    expect(databaseOptions(config).migrations).toContain(AddSellerLeadFinal1788220800003);
    expect(AppDataSource.options.migrations).toContain(AddSellerLeadFinal1788220800003);
  });

  it('adds and drops the catalog draft, item, evidence, valuation, status, and history columns', async () => {
    const { AddSellerLeadFinal1788220800003 } = await import('./1788220800003-add-seller-lead-final');

    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;

    const migration = new AddSellerLeadFinal1788220800003();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "catalog_draft" jsonb');
    expect(queries[0]).toContain('ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT \'draft\'');
    expect(queries[0]).toContain('ADD COLUMN "history" jsonb');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "catalog_draft"');
    expect(queries[0]).not.toContain('DROP COLUMN "status"');
  });

  it('registers the dashboard-detail column migration', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { AddSellerLeadDashboard1788220800004 } = await import(
      './1788220800004-add-seller-lead-dashboard'
    );

    expect(databaseOptions(config).migrations).toContain(AddSellerLeadDashboard1788220800004);
    expect(AppDataSource.options.migrations).toContain(AddSellerLeadDashboard1788220800004);
  });

  it('registers the internal enquiry text migration and adds the editable draft column', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { AddSellerEnquiryText1788220800007 } = await import('./1788220800007-add-seller-enquiry-text');

    expect(databaseOptions(config).migrations).toContain(AddSellerEnquiryText1788220800007);
    expect(AppDataSource.options.migrations).toContain(AddSellerEnquiryText1788220800007);

    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => { queries.push(sql); } } as unknown as QueryRunner;
    const migration = new AddSellerEnquiryText1788220800007();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "enquiry_text" text');
    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "enquiry_text"');
  });

  it('adds and drops comparables, service consent, and updated_at', async () => {
    const { AddSellerLeadDashboard1788220800004 } = await import(
      './1788220800004-add-seller-lead-dashboard'
    );

    const queries: string[] = [];
    const queryRunner = {
      query: async (sql: string) => {
        queries.push(sql);
      },
    } as unknown as QueryRunner;

    const migration = new AddSellerLeadDashboard1788220800004();
    await migration.up(queryRunner);
    expect(queries[0]).toContain('ADD COLUMN "comparables" jsonb');
    expect(queries[0]).toContain('ADD COLUMN "service_consent" boolean NOT NULL DEFAULT true');
    expect(queries[0]).toContain('ADD COLUMN IF NOT EXISTS "updated_at" timestamptz');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP COLUMN "comparables"');
    expect(queries[0]).not.toContain('DROP COLUMN "updated_at"');
  });

  it('registers the S1 intake draft entity and persistence migration in both data sources', async () => {
    const { databaseOptions } = await import('../app.module');
    const { default: AppDataSource } = await import('./data-source');
    const { SellerIntakeDraftEntity } = await import('./seller-intake-draft.entity');
    const { CreateSellerIntakeDrafts1788220800005 } = await import('./1788220800005-create-seller-intake-drafts');

    expect(databaseOptions(config).entities).toContain(SellerIntakeDraftEntity);
    expect(databaseOptions(config).migrations).toContain(CreateSellerIntakeDrafts1788220800005);
    expect(AppDataSource.options.entities).toContain(SellerIntakeDraftEntity);
    expect(AppDataSource.options.migrations).toContain(CreateSellerIntakeDrafts1788220800005);
  });

  it('creates a profile/session-scoped JSONB draft table with version tracking', async () => {
    const { CreateSellerIntakeDrafts1788220800005 } = await import('./1788220800005-create-seller-intake-drafts');
    const queries: string[] = [];
    const queryRunner = { query: async (sql: string) => { queries.push(sql); } } as unknown as QueryRunner;
    const migration = new CreateSellerIntakeDrafts1788220800005();

    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE IF NOT EXISTS "seller_intake_drafts"');
    expect(queries[0]).toContain('"profile_id"');
    expect(queries[0]).toContain('"session_id"');
    expect(queries[0]).toContain('"draft" jsonb');
    expect(queries[0]).toContain('UNIQUE ("profile_id", "session_id")');

    queries.length = 0;
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP TABLE "seller_intake_drafts"');
  });

});
