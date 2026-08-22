import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auctionLotFixtureSchema } from '../src';

const fixturePath = resolve(import.meta.dirname, '../../../fixtures/auction-data/lots.json');
const contents = await readFile(fixturePath, 'utf8');
const result = auctionLotFixtureSchema.safeParse(JSON.parse(contents));

if (!result.success) {
  console.error(result.error.format());
  process.exitCode = 1;
} else {
  console.log(`Validated ${result.data.length} auction lot fixture(s).`);
}
