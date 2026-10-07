// Week 3 input validation tests.

import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ComparableSaleDto, ValuationInputDto } from './valuation-calculation.dto';
import { input } from './fx-range.fixtures';

describe('Week 3: dated currency conversion and weighted range (DTO)', () => {

  // Accepts valid weights.
  it('accepts supplied comparable weights without stripping them', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const parsed = await pipe.transform(input(), {
      type: 'body',
      metatype: ValuationInputDto,
    });

    expect(parsed.comparables.map((sale: { weight: number }) => sale.weight)).toEqual([0.5, 1, 0.5]);
  });

  // Rejects invalid weights.
  it.each([
    -0.1,
    1.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '0.5',
    undefined,
  ])('rejects invalid weight %s at the weight field', async weight => {
    const comparable = plainToInstance(ComparableSaleDto, {
      ...input().comparables[0],
      weight,
    });

    const errors = await validate(comparable);

    expect(errors.some(error => error.property === 'weight')).toBe(true);
  });

  // Rejects invalid prices.
  it.each([
    0,
    -10,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid realized price %s', async soldPrice => {
    const comparable = plainToInstance(ComparableSaleDto, {
      ...input().comparables[0],
      soldPrice,
    });

    const errors = await validate(comparable);

    expect(errors.some(error => error.property === 'soldPrice')).toBe(true);
  });

  it.each([0, 0.5, 1])('accepts the valid weight boundary %s at the field-validation layer', async weight => {
    const errors = await validate(plainToInstance(ComparableSaleDto, { ...input().comparables[0], weight }));
    expect(errors).toHaveLength(0);
    // Zero is structurally valid; the service decides that it contributes no evidence.
  });

  it('rejects duplicate comparable IDs at the request boundary', async () => {
    const payload = input();
    payload.comparables[1]!.id = payload.comparables[0]!.id;
    const errors = await validate(plainToInstance(ValuationInputDto, payload));
    expect(errors.some(error => error.property === 'comparables')).toBe(true);
  });

  it.each(['', 'not-a-date', '2024-02-30'])('rejects the invalid calendar date "%s"', async saleDate => {
    const errors = await validate(plainToInstance(ComparableSaleDto, { ...input().comparables[0], saleDate }));
    expect(errors.some(error => error.property === 'saleDate')).toBe(true);
  });

  it.each(['', 'US', 'USDD', undefined])('rejects missing or malformed currency %s', async currency => {
    const errors = await validate(plainToInstance(ComparableSaleDto, { ...input().comparables[0], currency }));
    expect(errors.some(error => error.property === 'currency')).toBe(true);
  });

  it('accepts a well-formed unknown currency so the service can report missing FX', async () => {
    const errors = await validate(plainToInstance(ComparableSaleDto, { ...input().comparables[0], currency: 'JPY' }));
    expect(errors.filter(error => error.property === 'currency')).toHaveLength(0);
  });

  it.each(['itemId', 'itemVersion'] as const)('rejects an empty %s', async field => {
    const errors = await validate(plainToInstance(ValuationInputDto, { ...input(), [field]: '' }));
    expect(errors.some(error => error.property === field)).toBe(true);
  });

  it.each([null, {}, 'not-an-array'])('rejects malformed comparables %j', async comparables => {
    const errors = await validate(plainToInstance(ValuationInputDto, { ...input(), comparables }));
    expect(errors.some(error => error.property === 'comparables')).toBe(true);
  });

  it.each([null, {}, [{ id: 'x', reason: '' }], [{ id: '', reason: 'excluded' }]])(
    'rejects malformed upstream exclusions %j', async excludedComparables => {
      const errors = await validate(plainToInstance(ValuationInputDto, { ...input(), excludedComparables }));
      expect(errors.some(error => error.property === 'excludedComparables')).toBe(true);
    });

  it('accepts upstream exclusion reasons at the HTTP DTO boundary', async () => {
    const errors = await validate(plainToInstance(ValuationInputDto, {
      ...input(), excludedComparables: [{ id: 'excluded-sale', reason: 'Not comparable' }],
    }));
    expect(errors).toHaveLength(0);
  });
});
