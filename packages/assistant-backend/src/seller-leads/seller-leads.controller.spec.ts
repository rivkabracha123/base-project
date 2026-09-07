import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { CreateSellerLeadDto } from './create-seller-lead.dto';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

const enquiry = {
  profileId: 'profile-synthetic-1',
  contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
  serviceConsent: true,
} as CreateSellerLeadDto;

describe('SellerLeadsController', () => {
  it('creates a draft enquiry through the service and returns only its identifier', async () => {
    const draft = jest.fn().mockResolvedValue({
      id: 'lead-1',
      profileId: enquiry.profileId,
      contact: enquiry.contact,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const controller = new SellerLeadsController({ draft } as unknown as SellerLeadsService);

    await expect(controller.create(enquiry)).resolves.toEqual({ id: 'lead-1' });
    expect(draft).toHaveBeenCalledWith(enquiry);
  });

  it('exposes the draft enquiry route under the seller-leads path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SellerLeadsController)).toBe('seller-leads');
  });

  it('lists draft enquiries for the staff dashboard in the agreed shape', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'lead-1',
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);

    await expect(controller.list()).resolves.toEqual([
      {
        id: 'lead-1',
        profileId: enquiry.profileId,
        contact: enquiry.contact,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
