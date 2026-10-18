import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import type { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import type { LotSearchResult } from './lot-match';
import type { LotSearchDto } from './lot-search.dto';
import { LotsService } from './lots.service';

// Shared named-fixture proof of the buyer-search <-> lots-search contract; see the fixture's own `description`.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedResponse: PaginatedResult<AuctionLot>;
  expectedExplainedResponse: LotSearchResult;
  scenarios: Array<{ name: string; expectedRequest: LotSearchDto }>;
};

for (const scenario of contract.scenarios) {
  it(`returns the shared expectedResponse for scenario "${scenario.name}" (named fixture: ${contract.namedLotId})`, async () => {
    const entities = contract.expectedResponse.data.map((payload) => ({ payload }));
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities, raw: [] }),
      getCount: jest.fn().mockResolvedValue(contract.expectedResponse.total),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search(scenario.expectedRequest);

    expect(result).toEqual(contract.expectedExplainedResponse);
    // Both scenarios name the same lot's category (one canonical, one a Hebrew
    // alias) and must resolve to the identical query.
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
      { categories: ['rare_books'] },
    );
  });
}
