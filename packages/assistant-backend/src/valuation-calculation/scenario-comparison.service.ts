import { Injectable } from '@nestjs/common';
import { compareValuations, sellerLeadValuationSnapshotSchema, type ValuationComparison } from '@monabid/shared';
import { WITHHELD_IDENTIFIER, safeIdentifier, safeReason } from './privacy-projection';

export type ScenarioComparisonResult =
  | ValuationComparison
  | { status: 'invalid_input'; invalid: 'previous' | 'current' };

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// Compares two valuation report revisions of the same item. S1 keeps revisions in browser storage and
// sends the previous one, so both inputs are treated as untrusted: validated against the shared schema,
// never mutated, and free-text fields are projected before they are returned. S4 stores nothing here.
@Injectable()
export class ScenarioComparisonService {
  compare(previous: unknown, current: unknown): ScenarioComparisonResult {
    const before = sellerLeadValuationSnapshotSchema.safeParse(previous);
    if (!before.success) return deepFreeze({ status: 'invalid_input', invalid: 'previous' });
    const after = sellerLeadValuationSnapshotSchema.safeParse(current);
    if (!after.success) return deepFreeze({ status: 'invalid_input', invalid: 'current' });

    const result = compareValuations(before.data, after.data);
    if (result.status !== 'compared') return deepFreeze(result);

    const project = (side: typeof result.previous) => ({
      ...side,
      reportId: safeIdentifier(side.reportId, WITHHELD_IDENTIFIER),
      itemVersion: safeIdentifier(side.itemVersion, WITHHELD_IDENTIFIER),
      ...(side.refusalReason === undefined ? {} : { refusalReason: safeReason(side.refusalReason) }),
    });
    return deepFreeze({
      ...result,
      itemId: safeIdentifier(result.itemId, WITHHELD_IDENTIFIER),
      previous: project(result.previous),
      current: project(result.current),
    });
  }
}
