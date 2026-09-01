import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auctionLotFixtureSchema } from '@monabid/shared';
import AppDataSource from './data-source';
import { AuctionLotEntity } from './auction-lot.entity';
// ייבוא הישות והלוגיקה של הלידים
import { StaffOperationEntity } from './staff-operation.entity';

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  // 1. טעינת נתוני המכירות הפומביות (המקוריים)
  const fixturePath = resolve(__dirname, '../../../../fixtures/auction-data/lots.json');
  const fixtures = auctionLotFixtureSchema.parse(JSON.parse(await readFile(fixturePath, 'utf8')));
  const lotRepository = AppDataSource.getRepository(AuctionLotEntity);

  await lotRepository.upsert(
    fixtures.map((payload: any) => ({
      id: payload.id,
      payload,
      sourceProvider: payload.source.provider,
      sourceRecordId: payload.source.recordId,
    })),
    ['id'],
  );
  console.log(`Seeded ${fixtures.length} auction lot(s).`);

  // 2. טעינת נתוני הלידים ללוח הבקרה התפעולי (Staff Operations)
  const staffFixturePath = resolve(__dirname, '../../../../fixtures/staff-operations/leads.json');
  const staffLeads = JSON.parse(await readFile(staffFixturePath, 'utf8')) as Array<{
    id: string;
    type: 'buyer' | 'seller';
    clientName: string;
    status: string;
    requestDetails: string;
    createdAt: string;
  }>;
  const staffRepository = AppDataSource.getRepository(StaffOperationEntity);

  await staffRepository.upsert(
    staffLeads.map((lead: any) => ({
      id: lead.id,
      type: lead.type,
      clientName: lead.clientName,
      status: lead.status,
      requestDetails: lead.requestDetails,
      payload: lead,
      createdAt: new Date(lead.createdAt),
    })),
    ['id'],
  );
  console.log(`Seeded ${staffLeads.length} staff operation lead(s).`);

  await AppDataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});