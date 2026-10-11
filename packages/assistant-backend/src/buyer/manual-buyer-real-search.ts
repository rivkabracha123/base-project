import AppDataSource from '../database/data-source';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { LotsService } from '../lots/lots.service';
import { BuyerSearchOrchestrator, type LotsSearchClient } from './buyer-search.orchestrator';
import type { BuyerCriteria } from './buyer-criteria';
import type { SearchRequest } from './search-request';

// Default criteria: the named fixture lot, requested with a Hebrew
// category alias so a real run also proves the alias resolution.
const defaultCriteria: BuyerCriteria = {
  categories: ['ספרים נדירים'],
  creators: ['Yitzhak Abrabanel'],
  periods: [],
  media: [],
  keywords: [],
  geography: [],
  auctionHouseIds: [],
  price: { min: 1000, max: 1500, currency: 'USD' },
  language: 'en',
  hardConstraints: [],
};

// Runs the real BuyerSearchOrchestrator against the real LotsService and the
// live database (not a mock), so the printed results are ones you can actually use.
// Usage: npm run manual:buyer:real-search [-- '<BuyerCriteria JSON>']
async function run(): Promise<void> {
  const criteria: BuyerCriteria = process.argv[2] ? JSON.parse(process.argv[2]) : defaultCriteria;

  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(AuctionLotEntity);
  const lotsService = new LotsService(repository);
  const lotsSearch: LotsSearchClient = { search: (request: SearchRequest) => lotsService.search(request) };
  const orchestrator = new BuyerSearchOrchestrator(lotsSearch);

  const now = new Date().toISOString();
  const outcome = await orchestrator.search({
    criteria,
    language: criteria.language,
    leadId: 'manual-real-search-1',
    status: 'new',
    createdAt: now,
    searchedAt: now,
  });

  console.log(JSON.stringify(outcome, null, 2));
  await AppDataSource.destroy();
}

run().catch(async (error: unknown) => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
