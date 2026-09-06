import { LotsController } from './lots.controller';

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
});