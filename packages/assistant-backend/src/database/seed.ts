import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auctionLotFixtureSchema } from '@monabid/shared';
import AppDataSource from './data-source';
import { AuctionLotEntity } from './auction-lot.entity';

async function seed(): Promise<void> {
  const fixturePath = resolve(__dirname, '../../../../fixtures/auction-data/lots.json');
  const fixtures = auctionLotFixtureSchema.parse(JSON.parse(await readFile(fixturePath, 'utf8')));
  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(AuctionLotEntity);

  await repository.upsert(
    fixtures.map((payload) => ({
      id: payload.id,
      payload,
      sourceProvider: payload.source.provider,
      sourceRecordId: payload.source.recordId,
    })),
    ['id'],
  );

  console.log(`Seeded ${fixtures.length} auction lot(s).`);
  await AppDataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
