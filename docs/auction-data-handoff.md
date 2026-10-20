# P1 data handoff to Mali (P2) and Heni (S3)

## Shared contract

Import `AuctionLot`, `auctionLotSchema`, `auctionLotFixtureSchema`, and
`validateAuctionLotFixture` from `@monabid/shared`. The executable contract lives in
`packages/shared/src/auction-lot.ts` (shape) and `packages/shared/src/import-report.ts`
(per-record validation: rejects invalid records, duplicate IDs, and unsafe content
individually, without failing the whole batch).

The canonical fixture is `fixtures/auction-data/lots.json` — currently 16 frozen
records (`provider: "bidspirit-snapshot"`), grouped into 6 `itemKey` clusters that each
represent one physical item sold multiple times over the years.

## Endpoints

- `POST /api/lots/search` — free-text + filtered search (Mali's primary consumer route).
- `GET /api/lots/sample` — one sample lot.
- `GET /api/lots/:id` — single lot by id.
- `GET /api/lots/history/:itemKey` — all `sold` records sharing an `itemKey`, ordered by
  `saleDate` ascending. Returns an empty array for an unknown or unlinked `itemKey`.
- `GET /api/lots/import-report` — re-reads and re-validates `lots.json` fresh on every
  call; independent of whether the database is seeded or in sync with the file.

## How to run / configuration

1. Start local Postgres: `docker compose -f infra/docker-compose.yml up -d` (service
   `postgres`, port 5432, matches `DATABASE_URL` below — no manual setup needed beyond
   having Docker running).
2. Backend env (`packages/assistant-backend/.env`, copy from `.env.example`):
   `DATABASE_URL=postgresql://monabid:monabid@localhost:5432/monabid`, `PORT=3001`.
3. Seed the database from the frozen fixture: `npm run db:seed` (upsert — adds/updates
   only, see "known limitations" below) or `npm run db:reset` (drops schema, re-runs
   migrations, then seeds — a true clean slate; use this if the database contains stray
   records from earlier manual testing).
4. Start the backend: `npm run dev:backend` (or `npm run dev` for backend + client
   together). Verify with `GET http://localhost:3001/api/lots/import-report`.
5. Client env (`packages/assistant-client/.env`, copy from `.env.example`):
   `VITE_API_BASE_URL=http://localhost:3001/api`, `VITE_FIXTURE_MODE=false`. Setting
   `VITE_FIXTURE_MODE=true` makes the client read `lots.json` directly instead of
   calling the backend — useful for UI development without a running server/database,
   but it will not reflect anything seeded into the database.

## For Mali (P2 / search)

Fields actually populated across the 16 frozen records, verified directly against the
file (not assumed):
- `category` — always `rare_books` in the current frozen set. No second category exists
  right now.
- `creator` — populated in 7 of 16 (the rest are anonymous historical manuscripts; the
  field is legitimately optional, not a data gap).
- `period`, `medium`, `geography` — populated only where grounded in the record's own
  title/description or well-established fact about the named work. Fully populated for
  4 of 6 `itemKey` clusters (`atereth_zekeinim_example`, `sefer_hasidim_example`,
  `latter_prophets_commentary_example`, `esther_scroll_italy`). For the remaining 2
  (`bechinat_olam_parchment`, `ashkenazic_decorated_parchment`), `period` is left
  unset — there is no textual or factual basis for a value, and an invented one would be
  worse than none. `medium` is set for all 6; `geography` is set for 5 of 6.

Do not infer that an absent `period`/`geography` means "unknown date/place" in a UI
sense — it specifically means "not established for this demo record." Do not assume
these counts grow without checking the file again; the frozen set is the current team
branch version plus this enrichment, not the original 1-record committed fixture from
earlier weeks.

## For Heni (S3 / comparables)

`ComparablesService.findComparables` (`packages/assistant-backend/src/comparables/comparables.service.ts`)
reads the entire `auction_lots` table via `this.lots.find()` — no server-side filtering by P1.
Every lot is scored and kept, included or excluded with a reason; nothing is silently dropped.
Of the 16 frozen records, 11 are `status: 'sold'` with a `realizedPrice` (comparable-eligible);
5 are `status: 'upcoming'` (no `realizedPrice`, excluded from price comparison by Heni's own scoring,
not by P1). Verified directly via `POST /api/comparables/query` with `{"category": "rare_books"}`:
11 in `included`, 5 in `excluded` (reason: `"Not a completed sale (status: upcoming)..."`).

## Known limitations

- **Unsafe-content detection is a regex heuristic** (`EMAIL_PATTERN` in `import-report.ts`):
  catches standard email shapes, not deliberate obfuscation.
- **`seed.ts` never deletes rows.** `repository.upsert(records, ['id'])` only inserts or
  updates rows present in the current `lots.json`; a record removed from the file stays
  in any already-seeded local database until a full `npm run db:reset`.
- **`seed.ts` is stricter than `validateAuctionLotFixture`.** It calls
  `auctionLotFixtureSchema.parse(...)` directly (whole-array, throws on first invalid
  record) and has no awareness of the unsafe-content check — only
  `validateAuctionLotFixture` (used by `/lots/import-report` and CI) checks for that.
  This is a deliberate, known divergence, not a bug.
- **Two `itemKey` clusters have no `period`.** See "For Mali" above.

## Validation

`npm run fixtures:validate` → "Validated 16 auction lot fixture(s)."
`npm run test` → all workspaces pass (backend 1208/1208, client 220/220, shared 83/83, ui 1/1).
`npm run typecheck` → 0 errors.
Integration proof: `packages/assistant-backend/src/lots/lots.integration.spec.ts` —
`'keeps at least one sold, priced record in every frozen itemKey cluster'` and
`'serves real chronological sale history for a frozen itemKey cluster'`, both run
against the real frozen file, not a hand-picked example.
