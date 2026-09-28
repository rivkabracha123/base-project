# Comparable sales UI — handoff for the frontend owner

Deliverable from S3 (Heni Cohen): a real, importable `@monabid/ui` component for
`ComparableEvidence`. No backend logic or contract was touched, and it is not wired
into any existing frontend route — it's ready to import, not yet imported anywhere.

## What this is

A component that renders `ComparableEvidence` (the S3 -> S4 handoff shape,
`packages/shared/src/comparable.ts`) for a seller: which past sales counted as
evidence and, separately, which were found but excluded.

- **The component:** `packages/ui/src/components/ComparableEvidencePanel.tsx` —
  exports `ComparableEvidencePanel`, `ComparableSaleCard`, and the
  `ComparableSalesLabels` type. Built against the actual `ScoredComparable` /
  `ComparableEvidence` / `AuctionLot` types from `@monabid/shared`, styled to match
  `packages/ui/src/components/ItemCard.tsx`'s existing conventions (slate/indigo
  palette, `rounded-2xl` cards, `formatMoney`).
- **Exported from the package:** `packages/ui/src/index.ts` now re-exports it, the
  same way it already re-exports `ItemCard`. Any app can use it as
  `import { ComparableEvidencePanel, type ComparableSalesLabels } from '@monabid/ui'`
  — see `packages/assistant-client/src/app/SampleLotPage.tsx` for the existing
  pattern of importing a `@monabid/ui` component plus its labels type into a page.
- **Sample data for preview/QA:** `packages/ui/src/examples/comparable-evidence.sample-data.ts`
  exports `sampleComparableEvidence` and `sampleComparableSalesLabels`, shaped exactly
  like the real contract but with invented values, for previewing the component without
  a live backend. This file is *not* exported from `packages/ui/src/index.ts`.
- **Live visual preview (optional, secondary):** the previously published Artifact link
  — a static HTML mockup, useful for a quick look but no longer the primary deliverable.

## Real fields shown on each card

All pulled from `AuctionLot` (`packages/shared/src/auction-lot.ts`) and `ScoredComparable`
(`packages/shared/src/comparable.ts`) — nothing invented:

- `lot.imageUrl` (optional — falls back to a dignified "no image" placeholder)
- `lot.title.en` / `lot.title.he`
- `lot.auctionHouse.name`
- `lot.saleDate`, `lot.status`
- `lot.estimate.low` / `lot.estimate.high` (optional)
- `lot.realizedPrice` (optional; only shown as fact when the lot is `sold`)
- `comparable.matchReason` (included cards)
- `comparable.exclusionReason` (excluded rows; falls back to `matchReason` if absent)

`comparable.score` exists on the type but is intentionally not shown on the card face —
it's an internal ranking input, not a user-facing number, per the "why this counts" text
already being human-readable.

## Included vs. excluded

Mirrors `ComparableEvidence.included` / `.excluded` exactly (`partitionAndSort` in
`comparables/comparable-score.ts`). Excluded results render in a visually quieter,
dashed-border block below the included grid, each with its `exclusionReason` — never
mixed into the evidence grid, so a seller can't mistake an excluded lot for one that
backs the valuation.

## What's missing / not addressed here

- No fixture lot currently sets `imageUrl` (see `fixtures/auction-data/lots.json`), so
  both the "has photo" and "no photo" card states had to be demonstrated with sample data.
- `SellerItem.materials` (confirmed materials) isn't rendered as its own field — it only
  surfaces through the existing `matchReason` / `exclusionReason` text, since there's no
  separate materials field on `AuctionLot` to show independently.
- No integration was done: no new route, no fetch call to `POST /api/comparables/query`,
  no changes to `ComparablesController`/`ComparablesService`/`comparable-score.ts`, and
  `aluma-shilat/*` (S4) was not touched.

## Suggested next step for the frontend owner

Import `ComparableEvidencePanel` from `@monabid/ui` into the seller flow where
`ComparableEvidence` is already fetched (e.g. after calling
`POST /api/comparables/query`), supplying real `locale` and translated `labels`
(see `assistant-client/src/i18n/resources.ts` for the existing i18n pattern) in
place of `sampleComparableSalesLabels`. That import and route wiring is the one
step deliberately left undone here.

## What was verified

- `npm run typecheck --workspace=@monabid/ui` — passes.
- `npm run build --workspace=@monabid/ui` — passes; `dist/index.js` and
  `dist/index.d.ts` now include `ComparableEvidencePanel` / `ComparableSaleCard`.
- `npm run test --workspace=@monabid/ui` — existing suite still passes (1/1).
- `npm run typecheck --workspace=@monabid/assistant-client` — passes, confirming the
  rest of the app still compiles against the updated `@monabid/ui` package.
- No component render test was added — the package has no existing render test for
  any component (`ItemCard` included), so none was introduced here either.
