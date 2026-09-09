import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSellerLeadDto } from './create-seller-lead.dto';
import { SellerLeadsController } from './seller-leads.controller';
import type { SellerLeadsService } from './seller-leads.service';

const fixturePath = resolve(__dirname, '../../../../fixtures/demo-scenarios/seller-draft-enquiry.json');

describe('prepared draft-enquiry fixture', () => {
  it('validates the prepared draft-enquiry fixture', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const dto = plainToInstance(CreateSellerLeadDto, fixture.request);

    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(fixture.request.contact.email).toMatch(/@example\.test$/);
  });

  // Traces the named fixture from the draft enquiry into the staff dashboard.
  it('renders the prepared fixture as the dashboard row it declares', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const list = jest.fn().mockResolvedValue([
      {
        id: fixture.dashboardRow.id,
        profileId: fixture.request.profileId,
        contact: fixture.request.contact,
        recommendation: fixture.dashboardRow.recommendation ?? null,
        createdAt: new Date(fixture.dashboardRow.createdAt),
      },
    ]);
    const controller = new SellerLeadsController({ list } as unknown as SellerLeadsService);

    await expect(controller.list()).resolves.toEqual([
      { ...fixture.dashboardRow, recommendation: fixture.dashboardRow.recommendation ?? null },
    ]);
  });
});
