// Temporary manual test script. Run with: npx tsx manual-test-valuation.ts
// Delete this file when you're done — it is not part of the feature.
import { AlomaShilatService } from './src/aluma-shilat/aluma-shilat.service';

const service = new AlomaShilatService();

async function run() {
  console.log('\n=== Test 1: fewer than 3 sales -> expect refusal ===');
  console.log(await service.calculateValuation({
    itemId: 'test-1', itemVersion: 'v1',
    comparables: [
      { id: 'c1', saleDate: '2024-03-10', soldPrice: 1000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'a' },
      { id: 'c2', saleDate: '2024-02-15', soldPrice: 1100, currency: 'ILS', category: 'furniture', status: 'sold', source: 'b' },
    ],
  }));

  console.log('\n=== Test 2: exactly 3 valid sales -> expect supported ===');
  console.log(await service.calculateValuation({
    itemId: 'test-2', itemVersion: 'v1',
    comparables: [
      { id: 'c1', saleDate: '2024-03-10', soldPrice: 100000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'a' },
      { id: 'c2', saleDate: '2024-02-15', soldPrice: 110000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'b' },
      { id: 'c3', saleDate: '2024-01-20', soldPrice: 105000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'c' },
    ],
  }));

  console.log('\n=== Test 3: missing FX rate (unknown currency/date) -> expect refusal, not 1:1 ===');
  console.log(await service.calculateValuation({
    itemId: 'test-3', itemVersion: 'v1',
    comparables: [
      { id: 'c1', saleDate: '2024-03-10', soldPrice: 1000, currency: 'USD', category: 'furniture', status: 'sold', source: 'a' },
      { id: 'c2', saleDate: '1999-01-01', soldPrice: 1100, currency: 'USD', category: 'furniture', status: 'sold', source: 'b' },
      { id: 'c3', saleDate: '2024-01-20', soldPrice: 1200, currency: 'JPY', category: 'furniture', status: 'sold', source: 'c' },
    ],
  }));

  console.log('\n=== Test 4: one outlier sale -> expect it excluded ===');
  console.log(await service.calculateValuation({
    itemId: 'test-4', itemVersion: 'v1',
    comparables: [
      { id: 'c1', saleDate: '2024-03-10', soldPrice: 100000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'a' },
      { id: 'c2', saleDate: '2024-02-15', soldPrice: 105000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'b' },
      { id: 'c3', saleDate: '2024-01-20', soldPrice: 500000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'c' },
    ],
  }));

  console.log('\n=== Test 5: try to mutate a supported report -> expect it to fail ===');
  const result: any = await service.calculateValuation({
    itemId: 'test-5', itemVersion: 'v1',
    comparables: [
      { id: 'c1', saleDate: '2024-03-10', soldPrice: 100000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'a' },
      { id: 'c2', saleDate: '2024-02-15', soldPrice: 110000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'b' },
      { id: 'c3', saleDate: '2024-01-20', soldPrice: 105000, currency: 'ILS', category: 'furniture', status: 'sold', source: 'c' },
    ],
  });
  console.log('before mutation attempt:', result.valuationRange.min);
  try {
    result.valuationRange.min = 0;
    console.log('after mutation attempt (no throw):', result.valuationRange.min);
  } catch (error) {
    console.log('mutation threw as expected:', (error as Error).message);
  }
}

void run();
