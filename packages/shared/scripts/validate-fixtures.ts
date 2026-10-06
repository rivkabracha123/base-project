import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAuctionLotFixture } from '../src';

const fixturePath = resolve(import.meta.dirname, '../../../fixtures/auction-data/lots.json');
const contents = await readFile(fixturePath, 'utf8');
const { records, report } = validateAuctionLotFixture(JSON.parse(contents));

// The committed fixture is a curated, prepared snapshot — not live provider data — so CI still
// fails on any rejected record. Per-record reporting (vs. one opaque whole-array schema error)
// tells you exactly which records and why.
if (report.rejected > 0) {
  console.error(`Rejected ${report.rejected} of ${report.total} record(s).`);
  if (report.duplicateIds.length > 0) {
    console.error(`Duplicate IDs: ${report.duplicateIds.join(', ')}`);
  }
  for (const error of report.validationErrors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${records.length} auction lot fixture(s).`);
}
