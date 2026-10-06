// Week 3 API tests.

import {
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';

import { Test } from '@nestjs/testing';

import {
  ValuationCalculationModule,
} from './valuation-calculation.module';

import {
  ValuationCalculationService,
} from './valuation-calculation.service';

import {
  input,
  week3Scenarios,
} from './fx-range.fixtures';

// Uses fixed test FX rates.
jest.mock('./valuation-calculation.fixtures', () => ({
  USD_EXCHANGE_RATE_FIXTURES:
    jest.requireActual(
      './fx-range.fixtures',
    ).syntheticUsdRates,
}));

describe(
  'Week 3: dated currency conversion and weighted range (HTTP)',
  () => {
    let app: INestApplication;
    let url: string;
    let calculate: jest.SpyInstance;

    // Starts the test API.
    beforeAll(async () => {
      const module =
        await Test
          .createTestingModule({
            imports: [
              ValuationCalculationModule,
            ],
          })
          .compile();

      app =
        module.createNestApplication();

      calculate =
        jest.spyOn(
          module.get(
            ValuationCalculationService,
          ),
          'calculateValuation',
        );

      app.setGlobalPrefix('api');

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );

      await app.listen(
        0,
        '127.0.0.1',
      );

      url =
        `${await app.getUrl()}` +
        '/api/valuation-calculation/valuation';
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    beforeEach(() => {
      calculate.mockClear();
    });

    it('rejects an unknown sale status without invoking calculation', async () => {
      const payload = input();
      const response = await post({ ...payload, comparables: payload.comparables.map((sale, i) =>
        i === 0 ? { ...sale, status: 'invalid-status' } : sale) });
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toEqual(expect.arrayContaining([expect.stringContaining('status')]));
      expect(calculate).not.toHaveBeenCalled();
    });

    // Sends a POST request.
    const post =
      (body: unknown) =>
        fetch(url, {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body:
            JSON.stringify(body),
        });

    // Returns supported valuation.
    it(
      'returns the weighted USD report through the real controller and validation pipeline',
      async () => {
        const request =
          week3Scenarios
            .weightedUsd();

        const response =
          await post(request);

        expect(response.status)
          .toBe(201);

        expect(
          response.headers
            .get('content-type'),
        ).toContain(
          'application/json',
        );

        expect(calculate)
          .toHaveBeenCalledTimes(1);

        expect(
          calculate.mock.calls[0]![0],
        ).toMatchObject(request);

        const report =
          await response.json();

        expect(report)
          .toMatchObject({
            status: 'supported',
            itemVersion: 'v1',
            comparableCount: 3,

            valuationRange: {
              min: 858,
              max: 1142,
              currency: 'USD',
            },
          });
      },
    );

    // Returns business refusal.
    it(
      'returns a business refusal for a structurally valid request with two sales',
      async () => {
        const response =
          await post(
            week3Scenarios
              .insufficientSales(),
          );

        expect(response.status)
          .toBe(201);

        const report =
          await response.json();

        expect(calculate)
          .toHaveBeenCalledTimes(1);

        expect(report)
          .toMatchObject({
            status: 'refusal',
            itemVersion: 'v1',
            comparableCount: 2,
            reason:
              expect.any(String),
          });

        expect(
          report.reason.length,
        ).toBeGreaterThan(0);

        expect(report)
          .not
          .toHaveProperty(
            'valuationRange',
          );
      },
    );

    // Rejects missing itemId.
    it(
      'rejects a missing itemId at the actual HTTP boundary',
      async () => {
        const {
          itemId: _itemId,
          ...payload
        } = input();

        const response =
          await post(payload);

        expect(response.status)
          .toBe(400);

        const error =
          await response.json();

        expect(error)
          .toMatchObject({
            statusCode: 400,

            message:
              expect.arrayContaining([
                expect.stringContaining(
                  'itemId',
                ),
              ]),
          });

        expect(calculate)
          .not
          .toHaveBeenCalled();
      },
    );

    // Rejects invalid fields.
    it.each([
      {
        field: 'weight',
        value: -0.1,
        description:
          'negative weight',
        message:
          'must not be less than 0',
      },
      {
        field: 'weight',
        value: 1.1,
        description:
          'weight above one',
        message:
          'must not be greater than 1',
      },
      {
        field: 'soldPrice',
        value: 0,
        description:
          'zero price',
        message:
          'must be a positive number',
      },
      {
        field: 'soldPrice',
        value: -10,
        description:
          'negative price',
        message:
          'must be a positive number',
      },
    ])(
      'rejects $description before calling the service',
      async ({
        field,
        value,
        message,
      }) => {
        const payload = input();

        const invalidPayload = {
          ...payload,

          comparables:
            payload.comparables.map(
              (
                comparable,
                index,
              ) =>
                index === 0
                  ? {
                      ...comparable,
                      [field]: value,
                    }
                  : comparable,
            ),
        };

        const response =
          await post(
            invalidPayload,
          );

        expect(response.status)
          .toBe(400);

        const error =
          await response.json();

        expect(
          error.message,
        ).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              `${field} ${message}`,
            ),
          ]),
        );

        expect(calculate)
          .not
          .toHaveBeenCalled();
      },
    );
  },
);
