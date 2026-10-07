import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { validateAuctionLotFixture, type ImportReport } from '@monabid/shared';

@Injectable()
export class LotsImportReportService {
  async getReport(): Promise<ImportReport> {
    const fixturePath = resolve(__dirname, '../../../../fixtures/auction-data/lots.json');
    const input = JSON.parse(await readFile(fixturePath, 'utf8')) as unknown;
    return validateAuctionLotFixture(input).report;
  }
}