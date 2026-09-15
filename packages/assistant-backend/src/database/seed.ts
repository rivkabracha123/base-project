import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAuctionLotFixture } from '@monabid/shared';
import AppDataSource from './data-source';
import { AuctionLotEntity } from './auction-lot.entity';

async function seed(): Promise<void> {
  const fixturePath = resolve(__dirname, '../../../../fixtures/auction-data/lots.json');
  const input = JSON.parse(await readFile(fixturePath, 'utf8'));
  const { records: fixtures, report } = validateAuctionLotFixture(input);

  if (report.rejected > 0) {
    console.warn(`Skipping ${report.rejected} of ${report.total} record(s) that failed validation.`);
  }

  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(AuctionLotEntity);

  if (fixtures.length > 0) {
    await repository.upsert(
      fixtures.map((payload) => ({
        id: payload.id,
        payload,
        sourceProvider: payload.source.provider,
        sourceRecordId: payload.source.recordId,
      })),
      ['id'],
    );
  }

  console.log(`Seeded ${fixtures.length} auction lot(s).`);
  await AppDataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
