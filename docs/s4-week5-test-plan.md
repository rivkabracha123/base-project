# S4 Week 5 — preparation and test plan

This is a proposed test plan, not implemented tests or a completed Week 5 review.
Scope: recalculation after corrections, immutable report revisions and scenario comparison.

## Assumption to confirm

S4 does not store valuation reports. It calculates and returns a new immutable report for each
call, and S1 stores report revisions per item version. This is not yet confirmed in the
repository: confirm with S1 and Miryam before relying on it. The week description also lists
"persistence"; if S4 turns out to be required to store reports, repository tests (save, load by
ID, restart survival, save failure) must be added back.

## Preparation

- Node >=22 is required; local Node 24.19.0 and npm 11.17.0 are available.
- node_modules and the shared CJS build exist. Run shared build when its source changes
  or after a fresh checkout/install: `npm.cmd run build --workspace=@monabid/shared`.
- Use `npm.cmd` on this Windows machine because PowerShell blocks npm.ps1.
- Existing baseline: the Week 4 valuation and comparables suites pass; the full backend suite
  passed with 38 suites / 466 tests on the Week 4 branch.
- No server, database, external API or real account is required: all tests use deterministic
  synthetic fixtures.
- S1 has revision-related code, but the production mapping to S4 itemVersion is
  not established. Do not assume a lot ID, date or array index is an item version.

## Proposed tests

| # | Scenario and expected outcome | Level | Dependency |
| --- | --- | --- | --- |
| 1 | Corrected item version plus updated evidence produces a new report linked to that exact item/version | Service | Synthetic input now; S1 contract for integration |
| 2 | Prior report remains byte-equivalent after recalculation, including evidence and FX | Service | Local |
| 3 | New evidence produces the independently hand-calculated range, rather than reusing the previous range | Service | Local fixtures |
| 4 | Same calculation inputs reproduce numeric results, reasons and evidence; generated report IDs may differ | Service | Existing coverage to reuse |
| 5 | Correction reduces accepted sales below three: new report is refusal without range; old supported report survives | Service | Local |
| 6 | Additional valid evidence changes refusal to supported without overwriting the refusal | Service | Local |
| 7 | Missing FX excludes evidence with a reason; refuse below three remaining sales, otherwise calculate from the accepted remainder | Service | Existing FX coverage to reuse |
| 8 | An older calculation finishing after a newer one cannot become the current valuation for the corrected item | Service/integration | Agree current-version ownership with S1; may belong to S1 if S1 owns the current version |
| 9 | Comparing two supported scenarios retains both report IDs, versions, ranges and evidence; any displayed difference matches fixed expected values | Service + contract | Agree comparison DTO semantics |
| 10 | Comparison handles supported/refusal, refusal/supported and refusal/refusal without invented numeric differences | Service + contract | Agree comparison DTO semantics |
| 11 | Incompatible comparison inputs (and missing reports) receive explicit responses; no silent fallback to another report | Service | Agree whether cross-item comparison is allowed, and whether comparison takes report IDs or the reports themselves |
| 12 | Invalid/missing item/version fields are rejected before calculation | Service | Reuse current validation |
| 13 | Corrected-item handoff through selected evidence to a report and the dashboard projection succeeds for supported and refusal | Producer-consumer integration | S1/S3/S5 agreed boundaries; mock provider where appropriate |
| 14 | New projections expose no internal calculation fields beyond their intended boundary; logs and errors omit sensitive input | Privacy | Shared infrastructure review where needed |

## Implemented so far

| Plan # | Test file |
| --- | --- |
| 1, 2, 3, 4, 5, 6, 7 | `recalculation.spec.ts` |
| 9, 10, 11 | `scenario-comparison.spec.ts` |
| 14 (privacy) | `scenario-comparison.spec.ts` (privacy block), `scenario-comparison.http.spec.ts` |
| Comparison over HTTP | `scenario-comparison.http.spec.ts` |
| 12 (invalid item/version rejected before calculation) | `recalculation.spec.ts` ("the item input contract of a recalculation") |
| Acceptance scenario | `week5-acceptance.spec.ts` |
| Storage helpers (browser side) | `packages/shared/src/valuation-history.test.ts` |

Not yet implemented: 8 (current-version ownership, depends on S1), 13 (S1/S3/S5 handoff).

## Fixtures

Use synthetic item/version pairs and named reports. Include one hand-computed
supported pair, supported -> refusal, refusal -> supported, refusal -> refusal,
missing FX, an unknown or missing report and reversed completion order.
Use deterministic completion controls instead of timing/sleep-based race tests.
Do not invent FX rates for committed real fixtures; synthetic rates must be labeled.

## Suggested order

1. Agree who stores reports (assumption above) and the comparison semantics.
2. Implement tests 1–7 with synthetic fixtures; reuse existing numerical tests.
3. Add comparison tests 9–11.
4. Complete stale-version and producer/consumer tests (8, 13) after boundary decisions.
5. Run the S4 suite and backend typecheck, then document actual outcomes.

Suggested new test files (not yet created): recalculation.spec.ts, scenario-comparison.spec.ts.
Exact comparison DTO fields remain design decisions, not frozen contracts in this plan.

## Removed from the earlier draft

Four tests from the earlier 18-test draft were removed because they assume S4 stores reports
(save and load by ID, restart survival, save-failure handling) or belong to S5 (a submitted
lead's frozen snapshot, which is S5's persistence). They apply again only if S4 is required to store
reports.
