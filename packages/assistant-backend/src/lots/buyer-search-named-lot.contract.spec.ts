import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuctionLot, MatchReason, PaginatedResult } from '@monabid/shared';
import type { Repository } from 'typeorm';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import type { LotSearchDto } from './lot-search.dto';
import { LotsService } from './lots.service';

// Shared named-fixture proof of the buyer-search <-> lots-search contract; see the fixture's own `description`.
const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../fixtures/demo-scenarios/buyer-search-named-lot.json'), 'utf8'),
) as {
  namedLotId: string;
  expectedResponse: PaginatedResult<AuctionLot>;
  scenarios: Array<{
    name: string;
    expectedRequest: LotSearchDto;
    expectedMatchReasons: Record<string, MatchReason[]>;
  }>;
};

for (const scenario of contract.scenarios) {
  it(`returns the shared lots with the scenario's match reasons for "${scenario.name}" (named fixture: ${contract.namedLotId})`, async () => {
    const entities = contract.expectedResponse.data.map((payload) => ({ payload }));
    // One raw row per lot, as the SQL selects it: each list filter carries a
    // single value (position 0), and the price matched on the realized price
    // when the lot has one, otherwise on its estimate.
    const raw = contract.expectedResponse.data.map((lot) => ({
      categories_position: 0,
      creators_position: 0,
      price_basis: lot.realizedPrice ? 'realized' : 'estimate',
    }));
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities, raw }),
      getCount: jest.fn().mockResolvedValue(contract.expectedResponse.total),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<AuctionLotEntity>;

    const result = await new LotsService(repository).search(scenario.expectedRequest);

    expect(result).toEqual({
      ...contract.expectedResponse,
      data: contract.expectedResponse.data.map((lot) => ({
        lot,
        matchReasons: scenario.expectedMatchReasons[lot.id],
      })),
    });
    // Both scenarios name the same lot's category (one canonical, one a Hebrew
    // alias) and must resolve to the identical query.
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("lot.payload->>'category' IN (:...categories)"),
      { categories: ['rare_books'] },
    );
  });
}
