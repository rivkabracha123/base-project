// Week 5: recalculation after corrections. Heni's real ComparablesService scores lots held in a fake,
// mutable repository (the "evidence" changes between calls, like a correction would change it) and
// feeds the S4 valuation through ItemValuationService. Real committed FX fixtures; synthetic lots;
// no database or network.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Repository } from 'typeorm';
import { auctionLotSchema, type AuctionLot } from '@monabid/shared';
import { AuctionLotEntity } from '../database/auction-lot.entity';
import { ComparablesService } from '../comparables/comparables.service';
import { InvalidItemValuationRequestError, ItemValuationService } from './item-valuation.service';
import { ValuationCalculationService } from './valuation-calculation.service';

const template = auctionLotSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), '../../fixtures/auction-data/lots.json'), 'utf8'))[0]);

function lot(id: string, text: string, amount: number, currency = 'USD', saleDate = '2024-03-10'): AuctionLot {
  return auctionLotSchema.parse({
    ...template, id, category: 'paintings', status: 'sold', saleDate,
    title: { en: text }, description: { en: text }, realizedPrice: { amount, currency },
  });
}

const oil = (prices: number[]) => prices.map((price, index) => lot(`oil-${index}`, 'oil on canvas portrait', price));
const watercolor = lot('water-0', 'watercolor on paper landscape', 1000);

function setup(initial: AuctionLot[]) {
  let lots = initial;
  const repository = {
    find: jest.fn(async () => lots.map(entry => ({ id: entry.id, payload: entry, sourceProvider: entry.source.provider,
      sourceRecordId: entry.source.recordId, createdAt: new Date(), updatedAt: new Date() }))),
  } as unknown as Repository<AuctionLotEntity>;
  return {
    repository,
    service: new ItemValuationService(new ComparablesService(repository), new ValuationCalculationService()),
    replaceEvidence: (next: AuctionLot[]) => { lots = next; },
  };
}

const request = (itemVersion: string, materials: string[]) =>
  ({ itemId: 'item-1', itemVersion, item: { category: 'paintings', materials } });
const OIL_CANVAS = ['oil', 'canvas'];

// Everything that must be reproducible; the generated report id is deliberately excluded.
const withoutReportId = <T extends { reportId: string }>(report: T) => ({ ...report, reportId: undefined });

describe('recalculation after corrections', () => {
  it('produces a new report linked to the exact corrected item version', async () => {
    const { service } = setup([...oil([800, 1000, 1200]), watercolor]);

    const first = await service.calculateFromItem(request('v1', OIL_CANVAS));
    const second = await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(first).toMatchObject({ itemId: 'item-1', itemVersion: 'v1' });
    expect(second).toMatchObject({ itemId: 'item-1', itemVersion: 'v2' });
    expect(second.reportId).not.toBe(first.reportId);
  });

  it('leaves the earlier report unchanged after a recalculation', async () => {
    const { service, replaceEvidence } = setup(oil([800, 1000, 1200]));
    const first = await service.calculateFromItem(request('v1', OIL_CANVAS));
    const before = JSON.stringify(first);

    replaceEvidence(oil([900, 1100, 1300]));
    await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(JSON.stringify(first)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('uses the new evidence and the hand-calculated range, never the previous one', async () => {
    const { service, replaceEvidence } = setup(oil([800, 1000, 1200]));
    const first = await service.calculateFromItem(request('v1', OIL_CANVAS));

    replaceEvidence(oil([900, 1100, 1300]));
    const second = await service.calculateFromItem(request('v2', OIL_CANVAS));

    // 800/1000/1200: mean 1000, population sd 163.299 -> 836 to 1164.
    expect(first).toMatchObject({ status: 'supported', valuationRange: { min: 836, max: 1164 } });
    // 900/1100/1300: mean 1100, population sd 163.299 -> 936 to 1264.
    expect(second).toMatchObject({ status: 'supported', valuationRange: { min: 936, max: 1264 } });
  });

  it('reproduces identical numbers, reasons and evidence for identical inputs', async () => {
    const { service } = setup([...oil([800, 1000, 1200]), watercolor]);

    const first = await service.calculateFromItem(request('v1', OIL_CANVAS));
    const second = await service.calculateFromItem(request('v1', OIL_CANVAS));

    expect(withoutReportId(second)).toEqual(withoutReportId(first));
    expect(second.reportId).not.toBe(first.reportId);
  });

  it('gives a refusal when a correction leaves fewer than three credible sales, and the old report stays supported', async () => {
    const { service } = setup([...oil([800, 1000, 1200]), watercolor]);
    const first = await service.calculateFromItem(request('v1', OIL_CANVAS));

    // Correcting the material to watercolor leaves only one lot that corroborates it.
    const second = await service.calculateFromItem(request('v2', ['watercolor']));

    expect(second).toMatchObject({ status: 'refusal', reason: 'insufficient_comparable_sales', comparableCount: 1 });
    expect(second).not.toHaveProperty('valuationRange');
    expect(first).toMatchObject({ status: 'supported', valuationRange: { min: 836, max: 1164 } });
  });

  it('turns a refusal into a supported valuation when corrected evidence is sufficient, without changing the refusal', async () => {
    const { service } = setup([...oil([800, 1000, 1200]), watercolor]);
    const refused = await service.calculateFromItem(request('v1', ['watercolor']));
    const before = JSON.stringify(refused);

    const supportedAfterCorrection = await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(refused.status).toBe('refusal');
    expect(JSON.stringify(refused)).toBe(before);
    expect(supportedAfterCorrection).toMatchObject({ status: 'supported', valuationRange: { min: 836, max: 1164 } });
  });

  it('keeps original currencies and dated FX visible after a recalculation', async () => {
    // The committed FX fixtures contain EUR only for 2024-02-15.
    const { service } = setup([...oil([800, 1000]), lot('oil-eur', 'oil on canvas portrait', 3500, 'EUR', '2024-02-15')]);

    const report = await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(report.originalCurrencies).toContain('EUR');
    const eur = report.comparables.find(entry => entry.id === 'oil-eur')!;
    expect(eur).toMatchObject({ originalPrice: 3500, originalCurrency: 'EUR' });
    expect(eur.fx).toMatchObject({ to: 'USD', asOfDate: '2024-02-15' });
    expect(eur.fx.rate).toBeCloseTo(3.84 / 3.57, 10);
  });

  it('excludes a sale with missing FX with a reason and calculates from the remainder when three sales remain', async () => {
    const { service } = setup([...oil([800, 1000, 1200]), lot('oil-eur', 'oil on canvas portrait', 3500, 'EUR', '2024-03-10')]);

    const report = await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(report).toMatchObject({ status: 'supported', comparableCount: 3, missingExchangeRateComparableIds: ['oil-eur'] });
    expect(report.excludedComparables).toContainEqual({ id: 'oil-eur', reason: 'missing_exchange_rate_data' });
  });

  it('refuses, never assuming a 1:1 rate, when missing FX leaves fewer than three sales', async () => {
    const { service } = setup([...oil([800, 1000]), lot('oil-eur', 'oil on canvas portrait', 3500, 'EUR', '2024-03-10')]);

    const report = await service.calculateFromItem(request('v2', OIL_CANVAS));

    expect(report).toMatchObject({ status: 'refusal', reason: 'missing_exchange_rate_data', comparableCount: 2 });
    expect(report).not.toHaveProperty('valuationRange');
  });
});

describe('the item input contract of a recalculation', () => {
  const valid = { itemId: 'item-1', itemVersion: 'v2', item: { category: 'paintings', materials: OIL_CANVAS } };

  it.each([
    ['an empty itemId', { ...valid, itemId: '' }, 'itemId'],
    ['a blank itemId', { ...valid, itemId: '   ' }, 'itemId'],
    ['an itemId with an email address', { ...valid, itemId: 'privacy-test@example.invalid' }, 'itemId'],
    ['an empty itemVersion', { ...valid, itemVersion: '' }, 'itemVersion'],
    ['an itemVersion with spaces', { ...valid, itemVersion: 'version 2' }, 'itemVersion'],
    ['a non-string itemVersion', { ...valid, itemVersion: 2 }, 'itemVersion'],
    ['a missing item', { itemId: 'item-1', itemVersion: 'v2' }, 'item'],
    ['an item without a category', { ...valid, item: { materials: OIL_CANVAS } }, 'item'],
    ['an item with an empty category', { ...valid, item: { category: '' } }, 'item'],
    ['materials that are not strings', { ...valid, item: { category: 'paintings', materials: [1] } }, 'item'],
    ['a null request', null, 'request'],
  ])('rejects %s before any calculation', async (_name, request, field) => {
    const { service, repository } = setup([...oil([800, 1000, 1200])]);

    const attempt = service.calculateFromItem(request as never);

    await expect(attempt).rejects.toBeInstanceOf(InvalidItemValuationRequestError);
    await expect(attempt).rejects.toMatchObject({ field });
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('does not echo the rejected value in the error message', async () => {
    const { service } = setup([]);

    const attempt = service.calculateFromItem({ ...valid, itemId: 'privacy-test@example.invalid' });

    await expect(attempt).rejects.toThrow('Invalid itemId');
    await expect(attempt).rejects.not.toThrow('privacy-test');
  });

  it('never silently rewrites an identifier: an accepted request keeps its exact itemId and itemVersion', async () => {
    const { service } = setup([...oil([800, 1000, 1200])]);

    const report = await service.calculateFromItem({ ...valid, itemId: 'item-1.A', itemVersion: 'v2.1-corrected' });

    expect(report).toMatchObject({ itemId: 'item-1.A', itemVersion: 'v2.1-corrected' });
  });

  it('accepts a request with materials omitted', async () => {
    const { service } = setup([...oil([800, 1000, 1200])]);

    const report = await service.calculateFromItem({ itemId: 'item-1', itemVersion: 'v1', item: { category: 'paintings' } });

    expect(report).toMatchObject({ status: 'supported', itemVersion: 'v1' });
  });
});
