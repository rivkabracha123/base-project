import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot, PaginatedResult } from '@monabid/shared';
import type { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import type { LotSearchDto } from './lot-search.dto';
import { LotsService } from './lots.service';

// B3 <-> P2 Week 4 CONNECT: shared named-fixture proof for both verification reports; see the fixture's own `description`.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-p2-connect.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedResponse: PaginatedResult<AuctionLot>;
  scenarios: Array<{ name: string; expectedRequest: LotSearchDto }>;
};

for (const scenario of contract.scenarios) {
  it(`returns the shared expectedResponse for scenario "${scenario.name}" (named fixture: ${contract.namedLotId})`, async () => {
    const entities = contract.expectedResponse.data.map((payload) => ({ payload }));
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([entities, contract.expectedResponse.total]),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search(scenario.expectedRequest);

    expect(result).toEqual(contract.expectedResponse);
    // Both scenarios name the same lot's category (one canonical, one a Hebrew
    // alias) and must resolve to the identical query.
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
      { categories: ['rare_books'] },
    );
  });
}
