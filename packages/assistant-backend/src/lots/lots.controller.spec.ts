import type { LotSearchDto } from './lot-search.dto';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';

describe('LotsController', () => {
  it('exposes the import report through the W2 boundary', async () => {
    const report = {
      total: 1,
      accepted: 1,
      rejected: 0,
      duplicateIds: [],
      validationErrors: [],
    };
    const controller = new LotsController(
      {} as never,
      { getReport: jest.fn().mockResolvedValue(report) } as never,
    );

    await expect(controller.report()).resolves.toEqual(report);
  });

  it('forwards the search body to the service and returns its result', async () => {
    const paginated = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    const lotsService = {
      search: jest.fn().mockResolvedValue(paginated),
    } as unknown as LotsService;
    const controller = new LotsController(lotsService, {} as never);

    const body: LotSearchDto = {
      query: 'manuscript',
      language: 'en',
      filters: { categories: ['rare_books'] },
    };
    const result = await controller.search(body);

    expect(lotsService.search).toHaveBeenCalledWith(body);
    expect(result).toBe(paginated);
  });

  it('forwards an itemKey to the sale-history service method', async () => {
    const sales = [{ id: 'sale-1', itemKey: 'abrabanel_commentary' }];
    const lotsService = {
      findSaleHistoryByItemKey: jest.fn().mockResolvedValue(sales),
    } as unknown as LotsService;
    const controller = new LotsController(lotsService, {} as never);

    await expect(controller.history('abrabanel_commentary')).resolves.toBe(sales);
    expect(lotsService.findSaleHistoryByItemKey).toHaveBeenCalledWith('abrabanel_commentary');
  });
});
