import { describe, expect, it } from '@jest/globals';
import { LotsImportReportService } from './lots-import-report.service';

describe('LotsImportReportService', () => {
  it('returns the validated report for the committed fixture', async () => {
    const report = await new LotsImportReportService().getReport();

    expect(report).toEqual({
      total: 1,
      accepted: 1,
      rejected: 0,
      duplicateIds: [],
      validationErrors: [],
    });
  });
});