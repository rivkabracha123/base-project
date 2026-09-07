import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { ConfigService } from '@nestjs/config';

// AppModule validates configuration eagerly through ConfigModule.forRoot at import
// time, so the committed .env.example values are supplied before it is loaded.
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.DATABASE_URL ??= 'postgresql://monabid:monabid@localhost:5432/monabid';

describe('SellerLeadsModule', () => {
  it('registers the seller-leads controller in the application module graph', async () => {
    const { AppModule } = await import('../app.module');
    const { SellerLeadsModule } = await import('./seller-leads.module');
    const { SellerLeadsController } = await import('./seller-leads.controller');

    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(SellerLeadsModule);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SellerLeadsModule)).toContain(SellerLeadsController);
  });

  it('registers the seller lead entity with the application data source', async () => {
    const { databaseOptions } = await import('../app.module');
    const { SellerLeadEntity } = await import('../database/seller-lead.entity');

    const config = {
      getOrThrow: () => 'postgresql://monabid:monabid@localhost:5432/monabid',
    } as unknown as ConfigService;

    expect(databaseOptions(config).entities).toContain(SellerLeadEntity);
  });
});
