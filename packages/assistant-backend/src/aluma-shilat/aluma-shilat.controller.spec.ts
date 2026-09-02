import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AlomaShilatController } from './aluma-shilat.controller';
import { ValuationInputDto } from './aluma-shilat.dto';
import { AlomaShilatService } from './aluma-shilat.service';

const supportedPayload = {
  itemId: 'lot-integration-1',
  itemVersion: 'v1',
  comparables: [
    {
      id: 'c-1',
      saleDate: '2024-03-10',
      soldPrice: 120000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-a',
    },
    {
      id: 'c-2',
      saleDate: '2024-02-15',
      soldPrice: 130000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-b',
    },
    {
      id: 'c-3',
      saleDate: '2024-01-20',
      soldPrice: 125000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-c',
    },
  ],
};

describe('AlomaShilatController (integration)', () => {
  let controller: AlomaShilatController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AlomaShilatController],
      providers: [AlomaShilatService],
    }).compile();

    controller = moduleRef.get(AlomaShilatController);
  });

  it('accepts a valid valuation request body and returns a supported report', async () => {
    const dto = plainToInstance(ValuationInputDto, supportedPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const result = await controller.postValuation(dto);

    expect(result).toMatchObject({
      status: 'supported',
      itemVersion: 'v1',
      comparableCount: 3,
    });
  });

  it('accepts a valid valuation request body and returns a refusal report when evidence is insufficient', async () => {
    const dto = plainToInstance(ValuationInputDto, {
      ...supportedPayload,
      comparables: supportedPayload.comparables.slice(0, 2),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const result = await controller.postValuation(dto);

    expect(result).toMatchObject({
      status: 'refusal',
      reason: 'insufficient_comparable_sales',
    });
  });

  it('rejects a request body with an invalid comparable status before it reaches the service', async () => {
    const dto = plainToInstance(ValuationInputDto, {
      ...supportedPayload,
      comparables: [
        { ...supportedPayload.comparables[0], status: 'not-a-real-status' },
        ...supportedPayload.comparables.slice(1),
      ],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a request body missing required fields before it reaches the service', async () => {
    const dto = plainToInstance(ValuationInputDto, {
      itemVersion: 'v1',
      comparables: [],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
