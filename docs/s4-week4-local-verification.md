# S4 / Aluma Shilat — Week 4 local verification

## Scope and status

This records the locally verifiable part of `docs/data/developers/s4.json`, week 4:
the evidence report, confidence explanation, limitations and honest refusal.
It is not a declaration that all Week 4 producer/consumer agreements are complete.
No scoring-to-weight decision, S3 input adapter, S1 orchestration, SellerLead
persistence or P5 UI is implemented by this change.

## Changes

- `valuation-calculation.service.ts`: the backend `ValuationResult` type now
  discriminates supported reports from refusals. Supported requires range and
  calculation; refusal requires a reason and forbids range/calculation values.
  The formula, runtime JSON fields and input contract are unchanged.
- `week4-report.spec.ts`: additional local checks cover zero/one/two accepted
  sales, deeply frozen refusal evidence with dated FX, and absence of copied
  undeclared fields or console/Nest instance log calls during calculation.
  Privacy probes use synthetic markers only.

## Evidence

| Requirement | Local evidence | Limit |
| --- | --- | --- |
| Supported report, confidence and limitations | `fx-range.report.spec.ts`, `valuation-calculation.service.spec.ts`, `dashboard-valuation.spec.ts` | Confidence remains low and uncalibrated |
| Refusal below three accepted sales | `week4-report.spec.ts`, `fx-range.http.spec.ts` | S3 credibility selection is an upstream responsibility |
| Original prices, currency and dated FX retained | `fx-range.fx.spec.ts`, `fx-range.cross-rates.spec.ts`, `week4-report.spec.ts` | Fixture rates, no live FX |
| No assumed 1:1 rate for missing FX | FX and service tests; refusal test in `week4-report.spec.ts` | USD uses an explicit identity rate |
| Input/report immutability | `fx-range.service.spec.ts`, `valuation-calculation.service.spec.ts`, `week4-report.spec.ts` | Frozen in memory; not durable report storage |
| Output projection | `dashboard-valuation.spec.ts` | S5 API wiring remains outstanding |
| S3 boundary example | `fx-range.contract.spec.ts` | Test-only proposed mapping; does not freeze Heni's contract |
| Privacy within calculation | `week4-report.spec.ts`, `fx-range.safety.spec.ts`, `dashboard-valuation.spec.ts` | Not an application-wide logging/privacy certification |

## Remaining privacy boundaries

The service copies declared source strings and exclusion reasons into the audit
report. It does not classify arbitrary text as public/private. The dashboard mapper
replaces unverified source strings with a generic label and null URL, but upstream
exclusion reasons must still be appropriate for display. Safe public source provenance
remains a documented handoff gap.

Read-only inspection of shared HTTP infrastructure also found that the exception
filter returns `request.url`, and the pino configuration does not redact request URLs.
Sensitive query-string content therefore is not covered by the local calculation
checks. Shared HTTP logging/error handling was not changed as part of this S4-only
task. Do not mark the full privacy acceptance criterion complete based on these tests.

## Reproduce

Local results on 2026-09-15: backend typecheck passed; all 12 valuation suites
passed (149 tests). Before the additions, all 11 existing suites passed (143 tests).

Run from the repository root (use `npm.cmd` on Windows if PowerShell blocks npm.ps1):

```text
npm run build --workspace=@monabid/shared
npm run typecheck --workspace=@monabid/assistant-backend
npm run test --workspace=@monabid/assistant-backend -- --testPathPattern=valuation-calculation
```

The valuation tests use local fixtures; HTTP tests bind to loopback. They do not
require a real database or provider accounts. Existing tests in three fx-range files
had uncommitted user changes before this work; those files were not edited during
the local verification task. They are preserved in the Week 4 checkpoint at the
user's request before branching for Week 5. Suite results describe this working tree.

## Pending before the complete Week 4 review

1. Agree with Heni on the meaning and mapping of weight and on upstream exclusions.
2. Align and run the agreed producer/consumer test, including both HTTP routes if agreed.
3. Confirm item/version provenance with S1 and the output contract with S5/P5.
4. Resolve or explicitly review the remaining privacy boundaries above.
5. Record final verification evidence for the agreed contracts and commit the final handoff.
