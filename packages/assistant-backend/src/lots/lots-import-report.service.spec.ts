import { describe, expect, it } from '@jest/globals';
import { LotsImportReportService } from './lots-import-report.service';

describe('LotsImportReportService', () => {
  // Whatever the committed fixture holds, every record must validate: nothing rejected or duplicated.
  it('returns a clean validated report for the committed fixture', async () => {
    const report = await new LotsImportReportService().getReport();

    expect(report.total).toBeGreaterThan(0);
    expect(report.accepted).toBe(report.total);
    expect(report.rejected).toBe(0);
    expect(report.duplicateIds).toEqual([]);
    expect(report.validationErrors).toEqual([]);
  });
});