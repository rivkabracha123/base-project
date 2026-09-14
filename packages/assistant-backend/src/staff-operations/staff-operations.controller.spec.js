const { StaffOperationsController } = require('./staff-operations.controller');

describe('StaffOperationsController', () => {
  it('returns the privacy-limited lead list supplied by its domain service', async () => {
    const leads = [
      {
        id: 'buyer-lead',
        type: 'buyer',
        clientName: 'Synthetic Buyer',
        status: 'new',
        requestDetails: 'Looking for a rare manuscript.',
        createdAt: new Date('2026-08-31T11:15:00.000Z'),
      },
    ];
    const staffOperationsService = { findAll: jest.fn().mockResolvedValue(leads) };
    const controller = new StaffOperationsController(staffOperationsService);

    await expect(controller.getLeads()).resolves.toEqual(leads);
    expect(staffOperationsService.findAll).toHaveBeenCalledTimes(1);
  });
});
