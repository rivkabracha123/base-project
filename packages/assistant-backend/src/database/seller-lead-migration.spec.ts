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
    expect(createTable).toContain('CREATE TABLE "seller_leads"');
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
});
