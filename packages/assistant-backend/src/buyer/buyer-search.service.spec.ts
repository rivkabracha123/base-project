import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BuyerSearchService } from './buyer-search.service';

describe('BuyerSearchService', () => {
  it('creates a typed basic request from the committed auction fixture', () => {
    const [lot] = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../fixtures/auction-data/lots.json'), 'utf8'),
    ) as Array<{ title: { en: string }; category: string }>;
    if (!lot) throw new Error('Expected a committed auction fixture');

    const service = new BuyerSearchService();
    expect(
      service.createSearchRequest(
        { category: lot.category, creator: 'Yitzhak Abrabanel', missing: [] },
        'en',
      ),
    ).toEqual({ query: 'Yitzhak Abrabanel', language: 'en' });
  });
});
