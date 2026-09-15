# S4 handoff to S5 and P5

## Shared contract

Import `DashboardValuationDto`, `dashboardValuationSchema`,
`SellerLeadValuationSnapshot`, and `sellerLeadValuationSnapshotSchema` from
`@monabid/shared`. The executable contract is `packages/shared/src/dashboard-valuation.ts`.
Synthetic browser payloads are in `fixtures/valuation-dashboard/{supported,refusal}.json`.
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
  when explicitly excluded upstream; S4 does not automatically detect outliers.
- Confidence is currently always low and explicitly uncalibrated. The shared enum
  reserves medium/high without inventing thresholds. Limitations are always nonempty.
- External exclusion reasons must be suitable for public display before entering S4;
  this mapper does not classify or redact arbitrary text supplied upstream.

## Validation

Build shared first: `npm run build --workspace=@monabid/shared`.
Run `npm run test --workspace=@monabid/assistant-backend -- --runTestsByPath src/valuation-calculation/dashboard-valuation.spec.ts`.
The test covers real service -> snapshot -> browser DTO, both synthetic fixtures,
refusal honesty, exclusions, audit-field leakage, URL syntax and evidence consistency.
It does not claim SellerLead HTTP integration is implemented.
