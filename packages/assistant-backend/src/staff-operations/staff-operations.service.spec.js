const { StaffOperationsService } = require('./staff-operations.service');

describe('StaffOperationsService', () => {
  it('returns newest synthetic leads using only dashboard-safe fields', async () => {
    const newestLead = {
      id: 'lead-newest',
      type: 'buyer',
      clientName: 'Synthetic Buyer',
      status: 'new',
      requestDetails: 'Looking for a rare manuscript.',
      createdAt: new Date('2026-08-31T11:15:00.000Z'),
      payload: { contact: { email: 'do-not-expose@example.test' } },
    };
    const repository = { find: jest.fn().mockResolvedValue([newestLead]) };
    const service = new StaffOperationsService(repository);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'lead-newest', type: 'buyer', clientName: 'Synthetic Buyer', status: 'new',
        requestDetails: 'Looking for a rare manuscript.', createdAt: new Date('2026-08-31T11:15:00.000Z'),
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });
});
