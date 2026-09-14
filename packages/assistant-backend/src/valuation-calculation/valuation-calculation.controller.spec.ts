// Integration test: builds a real NestJS module and proves the controller + DTO validation work together.
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValuationCalculationController } from './valuation-calculation.controller';
import { ValuationInputDto } from './valuation-calculation.dto';
import { ValuationCalculationService } from './valuation-calculation.service';

// Shared valid payload (3 sold comparables) reused and tweaked by the tests below.
const supportedPayload = {
  itemId: 'lot-integration-1',
  itemVersion: 'v1',
  comparables: [
    {
      id: 'c-1',
      saleDate: '2024-03-10',
      weight: 1,
      soldPrice: 120000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-a',
    },
    {
      id: 'c-2',
      saleDate: '2024-02-15',
      weight: 1,
      soldPrice: 130000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-b',
    },
    {
      id: 'c-3',
      saleDate: '2024-01-20',
      weight: 1,
      soldPrice: 125000,
      currency: 'ILS',
      category: 'furniture',
      status: 'sold',
      source: 'auction-house-c',
    },
  ],
};

describe('ValuationCalculationController (integration)', () => {
  let controller: ValuationCalculationController;

  // Builds a real controller + service via NestJS's testing module before every test.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ValuationCalculationController],
      providers: [ValuationCalculationService],
    }).compile();

    controller = moduleRef.get(ValuationCalculationController);
  });

  // Goal: prove a fully valid request passes DTO validation and returns a supported report.
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

  // Goal: prove a valid request with too few comparables still passes validation but the service refuses.
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

  // Goal: prove an invalid enum value is rejected by validation before the service ever runs.
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

  // Goal: prove a request missing required fields is rejected by validation before the service ever runs.
  it('rejects a request body missing required fields before it reaches the service', async () => {
    const dto = plainToInstance(ValuationInputDto, {
      itemVersion: 'v1',
      comparables: [],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
