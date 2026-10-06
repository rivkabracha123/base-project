# S4 handoff to S5 and P5

## Shared contract

Import `DashboardValuationDto`, `dashboardValuationSchema`,
`SellerLeadValuationSnapshot`, and `sellerLeadValuationSnapshotSchema` from
`@monabid/shared`. The executable contract is `packages/shared/src/dashboard-valuation.ts`.
Synthetic browser payloads are inlined in `dashboard-valuation.spec.ts` (`dashboardFixtures`).
These example.com URLs and sales are synthetic, not real auction evidence.

## Racheli / S5

Call `toSellerLeadValuationSnapshot(report)` from the backend valuation-calculation
directory with the S4 result. Persist the returned snapshot at lead submission:
`{ itemId, itemVersion, calculationVersion, dashboard }`. The report ID is
`dashboard.reportId`. Return only `snapshot.dashboard` as the lead's `valuation`
field to P5. This field is the integration target, not an implemented SellerLead API field.
Do not silently recalculate or overwrite a submitted lead when an item changes.
A new calculation returns a new report ID; check the item version before attachment.
An absent valuation is not a refusal: do not invent a refusal report or price.

The existing calculation route is `POST /api/valuation-calculation/valuation`.
Its request remains `ValuationInputDto`; its response remains the full S4 audit report.
This change adds a backend mapper, not an HTTP endpoint or report persistence.
There is currently no GET-by-report-ID guarantee. S5 persistence and API wiring remain S5 work.

## Rivka Bracha / P5

Consume the dashboard projection via SellerLead API. Both branches require reportId,
comparableCount, limitations, comparables, and excludedComparables (empty arrays allowed).
Supported also requires valuationRange in USD and confidence { level, explanation }.
Refusal requires reason and forbids valuationRange and confidence. Show its accepted
evidence for context; accepted evidence does not imply a supported valuation.
Reason is a nonempty code/text from S4 or upstream, not a closed enum; render unknown
reasons as plain text. Never interpret it as HTML. Prices are indicative, not certified
appraisals or guaranteed sale prices. normalizedPrice, when present, is in USD.
Original currencies are available per comparable. Count equals comparables.length.

## Evidence and source semantics

- source is `{ label: string, url: string | null }`. Render labels as plain text.
- A non-null URL must identify the exact publicly accessible sale page verified by
  the backend. The schema additionally requires HTTPS and forbids credentials,
  query strings and fragments. Syntax checks alone do not prove a URL is public
  or unsigned (tokens can appear in paths). Never strip a signed URL to manufacture a public one.
- Today's S4 source is an unverified string. The mapper deliberately returns
  `{ label: 'Source unavailable', url: null }` until S3 provenance is integrated.
  This is an explicit remaining integration gap, not a fabricated source link.
- comparables are accepted sold evidence with positive prices and weights and available
  FX. Credibility/similarity filtering belongs to S3 and is not independently verified by S4.
- Missing FX generates `missing_exchange_rate_data` exclusions. Outliers appear only
  when explicitly excluded upstream; S4 does not automatically detect outliers. The full
  S4 report records this in `outlierTreatment` (method `none`, no removed comparables).
- Confidence is computed from comparable count and price spread (low, medium or high) by the
  rule in docs/s4-confidence-rules.pdf. Its thresholds are a team-adjustable proposal, not
  calibrated against outcomes, so it is not a probability. Refusals carry no confidence.
  Limitations are always nonempty.
- Privacy projection (`privacy-projection.ts`): S4 projects externally supplied strings before they
  enter a report. Ids, source, item id/version must be identifier-shaped and free of email, URL,
  credential keywords or phone numbers, or they are replaced; exclusion reasons are kept only as
  lowercase codes or approved S3 templates (seller-supplied materials text is dropped), otherwise
  they become `exclusion_reason_withheld_for_privacy`. Limitation: an opaque identifier-shaped
  token cannot be told apart from a legitimate identifier and is not detected. Shared production
  request logging (`main.ts`) is outside S4 ownership and does not redact `req.url`/`req.query`;
  the infrastructure owner must follow up.

## Agreements recorded (S4 with S5 and P5)

These are the agreements reported by Aluma (S4) from her discussions; the wording below is
copied from the replies she received.

### Racheli / S5

- In `sellerLeadDashboardDetailSchema`, the `valuation` field is the full
  `dashboardValuationSchema` / `DashboardValuationDto`: `comparableCount`, `confidence`,
  `limitations`, `comparables` and `excludedComparables`, for both supported and refusal.
- `itemId`, `itemVersion` and `calculationVersion` stay in the server-side
  `SellerLeadValuationSnapshot` envelope and are not returned by GET.
- S5 copies/maps to the full DTO without recalculating. `toSellerLeadValuationSnapshot(report)`
  stays with S4. When the schemas in `packages/shared/src/dashboard-valuation.ts` are in shared,
  S5 consumes them from there.

### Rivka Bracha / P5

- P5 approves `DashboardValuationDto` and the documented limitations, and consumes it only
  through S5's SellerLead API.
- Supported shows range, comparable count, confidence, limitations and evidence. Refusal shows
  reason, comparable count, limitations and evidence only, with no price range.
- P5 documents that "Source unavailable" is not a link, and does not show `itemId`,
  `itemVersion` or `calculationVersion`.
- Open point: P5's note says confidence is currently always low and uncalibrated. S4 now computes
  low/medium/high by docs/s4-confidence-rules.pdf; P5 should update that note to match.

## Validation

Build shared first: `npm run build --workspace=@monabid/shared`.
Run `npm run test --workspace=@monabid/assistant-backend -- --runTestsByPath src/valuation-calculation/dashboard-valuation.spec.ts`.
The test covers real service -> snapshot -> browser DTO, both synthetic fixtures,
refusal honesty, exclusions, audit-field leakage, URL syntax and evidence consistency.
It does not claim SellerLead HTTP integration is implemented.
