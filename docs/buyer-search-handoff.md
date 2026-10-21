# Buyer search handoff

How to run, diagnose and explain the buyer search: the application service that turns reviewed buyer criteria into a lots search, then hands explained results to the result cards or an honest no-result to the staff unmatched-demand dashboard. Everything below describes the code as it is in this repository; where the code does not do something yet, it says so under [Known limits](#known-limits).

The measured evidence for every claim is in [buyer-search-verification.md](buyer-search-verification.md).

## What it does, in one paragraph

It receives typed `BuyerCriteria` (already extracted and merged across turns by the buyer criteria service). It converts them into one typed `SearchRequest` and calls the lots search. It never reads lot files or the database itself and never re-ranks, adds or drops lots. It returns a `BuyerSearchOutcome` (`packages/shared/src/buyer-search-results.ts`): grouped explained results, an unmatched view that is also recorded for staff, or "insufficient criteria" when there is nothing to search. The buyer's budget and other strict filters are sent on every search. A filter is left out of a search only when the buyer approved dropping it, and that approval covers one search only.

## Where the code is

All paths are under `packages/assistant-backend/src/buyer/` unless stated.

| File | Responsibility |
|---|---|
| `buyer-search.orchestrator.ts` | The search flow: build the request, call the lots search, group results or record demand, report progress. `search()` and `searchOtherCategories()`. |
| `criteria-to-search-request.ts` | Criteria to `SearchRequest`: which fields become filters, keyword synonyms, period conversion, which values cannot be sent. |
| `approved-relaxation.ts` | Which filters may be offered for dropping, in fixed order (budget last), and the per-search copy without the approved ones. |
| `explained-results.ts` | Hard constraints derived from criteria, current/historical grouping, the staff demand summary. |
| `lots-service-search.client.ts` | Calls `LotsService.search` in-process after validating the request with the lots search's own `LotSearchDto`. Page 1, limit 50. |
| `unmatched-demand-dashboard-view.ts` | The privacy-safe staff view; keeps the first no-result request as the original and the buyer's latest later search as its expansion. |
| `unmatched-demand.store.ts`, `unmatched-demand.db-store.ts` | Where demand is recorded: in memory, or the `buyer_unmatched_demand` table. |
| `buyer-search-steps.ts` | The step lines the buyer sees during a search, in Hebrew and English: searching, details that could not be filtered, upcoming lots found, past sales found. |
| `buyer-search-status-message.ts` | A one-line status per outcome, in Hebrew and English (not used by the live chat; see [Known limits](#known-limits)). |
| `manual-buyer-real-search.ts` | Command-line run against the real database (see [Runbook](#runbook)). |

Callers of the search, owned by other parts of the buyer flow: `buyer-search-execution.service.ts` (entry point for the result cards), `batya-buyer-results-presentation.service.ts` (result cards), `buyer-session-search.service.ts` (`POST /api/buyer/sessions/:sessionId/search` and the "other categories" follow-up).

## Contracts

### In: buyer criteria

`BuyerSearchInput` in `buyer-search.orchestrator.ts`: `criteria`, `language` (`he` | `en`), `leadId`, `status`, `createdAt`, `searchedAt`, optional `selectedLotId` (passed through untouched), optional `approvedRelaxations` (`{ field, approvedAt }[]`).

### Out to the lots search

| Criteria field | Sent as | Rule |
|---|---|---|
| `keywords` | `query` | Space-joined. Hebrew and English terms for manuscript, antique, Hebrew and rare are replaced by one English search word; blank keywords are dropped. |
| `categories`, `creators` | `filters.*` as given | The lots search resolves Hebrew/English aliases itself. |
| `auctionHouseIds` | `filters.auctionHouseIds` as given | Matched on the exact house id; there are no aliases. |
| `periods` | `filters.periods` | Only `19th`, `19th century` or a 4-digit year convert (`1890` becomes `19th century`); anything else is not sent. |
| `geography`, `media` | `filters.*` | English values only; a Hebrew value is not sent. |
| `dateRange` | `filters.dateRange` | Sent as given; the lots search rejects an impossible date. |
| `price` | `filters.price` | Sent exactly as given. Never widened, never dropped without approval. An inverted range (min above max) is rejected by the lots search's validation, so the search ends in an error and no demand is recorded. |

The lots search matches the budget on a lot's realized price when it has one, whatever its status. A lot without a realized price (including upcoming and withdrawn lots) matches when its estimate band overlaps the budget. A lot with neither is excluded whenever a budget is sent. Amounts are compared as-is, without currency conversion.

### Out to the result cards

`kind: 'results'`: `results.current` (lots with status `upcoming`) and `results.historical` (every other status), each in the lots search's order with its `matchReasons` as reported by the lots search; `approvedRefinements` lists the filters dropped for this search; `searchRequest.criteria` is the buyer's full criteria, including any dropped filter.

`kind: 'unmatched'`: `relaxationOptions` lists the filters the buyer may choose to drop next, each with `requiresApproval: true`, budget last. No lot is returned or invented.

`kind: 'insufficient-criteria'`: nothing was sent and no demand recorded.

### Out to the staff dashboard

`BuyerUnmatchedDemandDashboardView`: lead id, status, times, the original `searchRequest`, `reason: 'no_results'`, and `demandSummary` (`appliedCriteria` actually sent, the buyer's `hardConstraints`, `recovery` and `relaxedFields`). A later search by the same lead adds `expansion` with `changedFields`, `relaxedFields`, `outcome` (`no_results` or `results`) and `resultCount`. The view holds no contact or conversation data.

### Progress

`onProgress` reports `searching`, then one of `results-found` (with a count), `no-results`, `insufficient-criteria` or `error`. It carries no lot data. A listener that throws is ignored.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `DATABASE_URL` | `packages/assistant-backend/.env` (see `.env.example`) | Database for the lots search and the `buyer_unmatched_demand` table. Default `postgresql://monabid:monabid@localhost:5432/monabid`. |
| Lots search limit | `DEFAULT_SEARCH_LIMIT` in `lots-service-search.client.ts` | 50 lots, page 1. More matches are not fetched. |
| Demand store | Constructor argument of `BuyerSearchOrchestrator` | Defaults to the in-process `unmatchedDemandStore`. `buyer.module.ts` also registers an orchestrator over `UnmatchedDemandDbStore`. |
| Category and creator aliases | `packages/assistant-backend/src/lots/lot-aliases.json` | Read by the lots search to match Hebrew and English names to one category or creator. |

No API key, network call or feature flag is involved.

## Runbook

From the repository root.

```sh
# Unit and measured-benchmark suites for the buyer search (no database needed)
npm test -w @monabid/assistant-backend -- src/buyer

# Only the measured benchmarks: strict constraints, no results, refinement, ranking
npm test -w @monabid/assistant-backend -- src/buyer/buyer-strict-constraints

# Against the real database: migrate and seed the committed lots, then run one search
npm run db:migrate && npm run db:seed
cd packages/assistant-backend
npx tsx src/buyer/manual-buyer-real-search.ts
npx tsx src/buyer/manual-buyer-real-search.ts '{"categories":["rare_books"],"creators":[],"periods":[],"media":[],"keywords":[],"geography":[],"auctionHouseIds":[],"price":{"min":100,"max":500,"currency":"USD"},"language":"he","hardConstraints":[]}'
```

The manual script prints the full `BuyerSearchOutcome` as JSON. Without an argument it searches the Hebrew alias "ספרים נדירים", creator Yitzhak Abrabanel and a 1,000–1,500 USD budget.

### Adding a benchmark scenario

Add an entry to `fixtures/demo-scenarios/buyer-search-strict-constraints.json` with `name`, `language`, `criteria` (merged over empty criteria), optional `approvedRelaxations`, and `expected`: the exact `request` sent (or `null`), `kind`, and either `lotIds` in order or `relaxationOptions`, `appliedCriteria`, `recovery` and `demandRecorded`. The lots it runs over are in `buyer-search-strict-constraints.lots.json`. The fake repository in the spec applies category, creator, auction house, date and price filters with the lots search's rules. Period, geography, medium and free text are not emulated, so a scenario that sends them must be measured against the real database with the manual script instead.

## Diagnosing

| Symptom | Likely cause | Where to look |
|---|---|---|
| `InvalidLotsSearchRequestError: ... invalid filters.price.min` | The criteria broke a lots search rule (negative amount, non-ISO currency, impossible date, date with time). The error names fields, never values. | `lots-service-search.client.spec.ts` |
| Progress `error`, no demand recorded | Lots database failure, a response without a result list, or a failed demand save. The original error is rethrown. | Server log; `buyer-strict-constraints...spec.ts` "service failure" |
| Buyer sees "not filtered by period / location / medium" | A period, place or medium the lots search cannot read was left out of the request rather than guessed. | `unfilteredCriteria` in `criteria-to-search-request.ts` |
| `insufficient-criteria` although the buyer said something | Only blank keywords or unreadable period/place/medium values were given. | Benchmark scenario `nothing-searchable` |
| The manual script finds fewer lots than the committed data holds (e.g. `unmatched` for the default search) | The local database was seeded from an older `lots.json`. | `npm run db:seed` again (it upserts by lot id; nothing is deleted) |
| A lot within budget is missing | Sold lots are matched on realized price, not estimate; or more than 50 lots matched. | `lots.service.ts` price rule; `DEFAULT_SEARCH_LIMIT` |
| A lot outside the stated budget appears | The buyer approved dropping `price` for that search; `approvedRefinements` contains `price`. | The outcome's `approvedRefinements` |
| The same lead appears once in staff demand after several searches | By design: the first no-result is the original, the latest later search is the `expansion`. | `unmatched-demand-dashboard-view.spec.ts` |

## Rules that must survive any change

1. **Typed criteria map to the lots search.** Criteria are sent as filters and query through `criteriaToSearchRequest`; this service never filters, ranks or reads lots itself. Evidence: every benchmark scenario asserts the exact request sent; the boundary test fails if a lot file is read during a search.
2. **Budgets and strict filters survive refinement.** The budget is sent on every search unless the buyer approved dropping it for that one search; approving another filter keeps the budget; the buyer's criteria and hard constraints come back unchanged even when a search ran without a filter. Evidence: `sends the budget exactly as given...`, `other-filter-approved-budget-kept`, the five-turn refinement test.

### Boundary failures checked

| Failure | What prevents it | Test |
|---|---|---|
| Calling raw source data | Lots come only from `LotsService.search` through `LotsSearchClient`. | `reads lots only through the lots search, never from a raw source file` |
| Relaxing budget without permission | `appliedRelaxations` ignores any field not approved; `price` is only dropped when approved and active. | `sends the budget exactly as given in every scenario unless the buyer approved dropping it`; `never relaxes the budget without approval, even when another filter is approved` |

## Known limits

- **Approval is not wired from the chat yet.** The orchestrator accepts `approvedRelaxations` and returns `relaxationOptions`, but the live chat path (`buyer-search-execution.service.ts` called by the result cards) does not pass approvals, so a buyer cannot yet approve dropping a filter from the chat. No consumer works around this; the budget is simply always sent.
- **Live demand is recorded in memory.** The chat path constructs its orchestrator with the default in-process store, so demand from the chat is lost on restart. The database-backed orchestrator is registered in `buyer.module.ts` but no caller injects it yet.
- **The staff dashboard does not read recorded demand yet.** `staff-operations.module.ts` serves buyer leads from `FixtureBuyerLeadDashboardSource`. The view shape it should read is `BuyerUnmatchedDemandDashboardView`, available from `UnmatchedDemandDbStore.list()` / `get(leadId)`.
- **One creator in the committed data.** In the frozen auction data seven lots carry a `creator`, all `yitzhak_abrabanel`; a filter on any other creator returns nothing until the data adds one.
- **Lot status is taken as stored.** Grouping uses `status`, not the sale date, so an `upcoming` lot whose sale date has passed is still shown as current.
- **No currency conversion.** Budgets and prices are compared as plain amounts.
- **50-lot cap.** Only the first page of 50 is fetched; there is no pagination through the buyer search.
- **Period, geography and medium** are sent only in the forms listed above; Hebrew place or medium names are not sent and the buyer is told so.
- **`statuses`** is supported by the lots search but not sent, since buyer criteria do not carry it.
- **Free text needs at least half of its words.** A lot is returned only when at least half of the `query` words (rounded up) appear in its title or description, so more keywords can mean fewer results.
- **`unrecognizedFilters` is not read.** On an empty result the lots search returns the filter values that exist on no lot; the buyer search ignores them.
- **Only category and creator have aliases.** Auction houses are matched by exact id; period, medium and geography have no Hebrew/English aliases.
- **`toBuyerSearchStatusMessage`** is tested but not called by the live chat, which shows the step texts from `buyer-search-steps.ts` instead.
