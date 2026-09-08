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

  it('delegates search requests to LotsService.searchByText with pagination parameters', async () => {
    // Mock service returns a paginated structure
    const mockPaginatedResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };

    const lotsService = {
      searchByText: jest.fn().mockResolvedValue(mockPaginatedResult),
    } as unknown as LotsService;

    const controller = new LotsController(lotsService, {} as never);

    const result = await controller.search({
      query: 'manuscript',
      language: 'en',
      page: 1,
      limit: 10,
    });

    // Verify service call receives all query parameters
    expect(lotsService.searchByText).toHaveBeenCalledWith('manuscript', 'en', 1, 10);
    expect(result).toEqual(mockPaginatedResult);
  });

  it('delegates to LotsService even when no query is provided', async () => {
    const mockEmptyResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };

    const lotsService = {
      searchByText: jest.fn().mockResolvedValue(mockEmptyResult),
    } as unknown as LotsService;

    const controller = new LotsController(lotsService, {} as never);

    const result = await controller.search({});

    // Verify controller delegates empty query handling directly to the service
    expect(lotsService.searchByText).toHaveBeenCalledWith(undefined, 'he', undefined, undefined);
    expect(result).toEqual(mockEmptyResult);
  });
});