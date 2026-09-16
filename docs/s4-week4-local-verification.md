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

Following the review, the exception filter now omits query strings and fragments
from the returned path. Production HTTP logging options redact req.url in addition
to authorization, cookies and request bodies. `common/http-privacy.spec.ts` verifies
the error response and captures real loopback HTTP logs with synthetic markers.
Dashboard URL test names now use case labels instead of printing the test URLs.
These checks cover these specific leaks, not arbitrary private text in source/reasons.

## Reproduce

Latest local results: backend typecheck passed; all 13 selected suites passed
(153 tests), including the HTTP privacy regressions and all 149 valuation tests.

Run from the repository root (use `npm.cmd` on Windows if PowerShell blocks npm.ps1):

```text
npm run build --workspace=@monabid/shared
npm run typecheck --workspace=@monabid/assistant-backend
npm run test --workspace=@monabid/assistant-backend -- --testPathPattern=valuation-calculation --testPathPattern=common
```

The valuation tests use local fixtures; HTTP tests bind to loopback. They do not
require a real database or provider accounts. Existing tests in three fx-range files
had uncommitted user changes before this work; those files were not edited during
the local verification task. They are preserved in the Week 4 checkpoint at the
user's request before branching for Week 5. Suite results describe this working tree.

## Pending before the complete Week 4 review

1. Heni's contract is agreed: provider maps to source, score to weight, included
   participates in calculation, exclusions are audit only, and S1 supplies item/version.
   The local contract example now uses provider. Production adapter is not required for Week 4.
2. Obtain and independently run Heni's reported commit 064e91d; it is not available locally yet.
3. Confirm item/version provenance with S1 and the output contract with S5/P5.
4. Resolve or explicitly review the remaining privacy boundaries above.
5. Record final verification evidence for the agreed contracts and commit the final handoff.
