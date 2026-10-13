import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auctionLotFixtureSchema, type AuctionLot } from '@monabid/shared';
import AppDataSource from './data-source';
import { AuctionLotEntity } from './auction-lot.entity';
import { chatDemoLots } from './chat-demo-fixture';

// Synthetic prices are for local integration testing, never production sale evidence.
async function seedChatDemo(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://monabid:monabid@localhost:5432/monabid');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Demo seeding is restricted to a local database');
  }
  const fixtures = auctionLotFixtureSchema.parse(JSON.parse(await readFile(
    resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8',
  )));
  const demos: AuctionLot[] = ['rings', 'rare_books'].flatMap(category =>
    [0, 1, 2, 3].map(index => ({
      id: `demo-chat-${category}-${index + 1}`,
      itemKey: `demo_chat_${category}_same_item`,
      source: {
        provider: 'synthetic-development-demo', recordId: `demo-${category}-${index + 1}`,
        url: `https://example.test/demo/${category}/${index + 1}`,
        retrievedAt: '2026-10-11T00:00:00.000Z',
      },
      auctionHouse: { id: 'demo-house', name: 'DEMO auction house (not a real venue)' },
      auctionTitle: 'DEMO - synthetic integration test data',
      lotNumber: String(index + 1),
      imageUrl: 'http://127.0.0.1:5173/history-lot.jpg',
      title: { en: category === 'rings' ? 'DEMO blue silver ring size 8' : 'DEMO antique Hebrew manuscript' },
      description: { en: 'DEMO ONLY. Fabricated sale and price for local testing, not verified market evidence. Silver / paper item in good condition.' },
      category, geography: 'israel', medium: category === 'rings' ? 'silver' : 'paper',
      saleDate: index === 3 ? '2026-12-01' : ['2023-04-12', '2024-11-14', '2025-01-23'][index]!,
      status: index === 3 ? 'upcoming' as const : 'sold' as const,
      estimate: { low: { amount: 100, currency: 'USD' }, high: { amount: 300, currency: 'USD' } },
      ...(index < 3 ? { realizedPrice: { amount: [150, 180, 220][index]!, currency: 'USD' } } : {}),
    })),
  );
  const payloads = auctionLotFixtureSchema.parse([...fixtures, ...demos, ...chatDemoLots()]);
  await AppDataSource.initialize();
  try {
    const repository = AppDataSource.getRepository(AuctionLotEntity);
    const before = await repository.count();
    await repository.createQueryBuilder().insert().values(payloads.map(payload => ({
      id: payload.id, payload, sourceProvider: payload.source.provider, sourceRecordId: payload.source.recordId,
    }))).orIgnore().execute();
    // Add the temporary image only to demo records that do not already have one.
    let imagesAdded = 0;
    await AppDataSource.transaction(async manager => {
      const demosRepository = manager.getRepository(AuctionLotEntity);
      const rows = await demosRepository.findBy({ sourceProvider: 'synthetic-development-demo' });
      for (const row of rows) {
        if (row.payload.imageUrl) continue;
        row.payload = { ...row.payload, imageUrl: 'http://127.0.0.1:5173/history-lot.jpg' };
        await demosRepository.save(row);
        imagesAdded++;
      }
    });
    const after = await repository.count();
    const first = await repository.findOneBy({ id: 'lot-kestenbaum-54554-121421' });
    const demoCount = await repository.createQueryBuilder('lot').where('lot.sourceProvider = :provider', { provider: 'synthetic-development-demo' }).getCount();
    console.log(JSON.stringify({ inserted: after - before, totalLots: after, requestedLotPresent: Boolean(first), demoLots: demoCount, imagesAdded }));
  } finally {
    await AppDataSource.destroy();
  }
}

seedChatDemo().catch(error => {
  console.error(error instanceof Error && error.message === 'Demo seeding is restricted to a local database'
    ? error.message : 'Demo seeding failed; no database credentials were logged.');
  process.exitCode = 1;
});
