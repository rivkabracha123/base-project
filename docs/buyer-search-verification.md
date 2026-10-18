# Buyer search verification: strict constraints, no results, refinement, ranking

How the buyer search was verified at the boundary between typed buyer criteria, the lots search, the result cards and the staff unmatched-demand dashboard. Every claim below points to a fixture or a test that fails if the behavior changes.

## Reproduce

From the repository root:

```sh
# The verification suites in this document (about 15 s)
npm test -w @monabid/assistant-backend -- src/buyer/buyer-strict-constraints src/buyer/lots-service-search.client src/buyer/buyer-search.orchestrator.spec

# Every buyer search and lots search suite
npm test -w @monabid/assistant-backend -- src/buyer src/lots
```

No database, network, API key or credential is needed: the real `LotsService` runs over a faked repository that returns the committed lots from `fixtures/auction-data/lots.json`.

## Named fixture traced end to end

Fixture: [`fixtures/demo-scenarios/buyer-search-strict-constraints.json`](../fixtures/demo-scenarios/buyer-search-strict-constraints.json), named lot `lot-kestenbaum-54554-121421` (realized 1,200 USD, sold 2025-01-23).

1. **Buyer criteria in.** `{ categories: ["rare_books"], price: { min: 100, max: 500, currency: "USD" } }`.
2. **Lots search request.** `criteriaToSearchRequest` sends `filters.categories` and `filters.price` unchanged. `LotsServiceSearchClient` validates the request against the lots search's own `LotSearchDto` before calling `LotsService.search`.
3. **Strict budget, no result.** No lot is within 100–500. The buyer gets `kind: "unmatched"` with relaxation options `categories`, `price`, each with `requiresApproval: true`. Staff get a demand record listing `appliedCriteria: ["price", "categories"]` and `recovery: "no_relaxation_no_invention"`. No lot is invented.
4. **Approved refinement.** The buyer approves dropping the budget for one search. The request is sent without `price`, and the result cards receive all three lots in lots-search order, the named lot first, unmodified, with no `price` match reason and `approvedRefinements: ["price"]`. The buyer's budget stays in `searchRequest.criteria` and in the hard constraints.
5. **Next turn.** With no new approval, the budget is sent again.

## Measured results

Measured against the three committed lots; each row is asserted by `buyer-strict-constraints.real-search.integration.spec.ts`.

| Scenario | Sent to lots search | Outcome | Lots handed on, in order |
|---|---|---|---|
| `strict-budget-two-lots` | category + price 900–1300 | results | `…121421`, `kedem-…88421` |
| `hebrew-category-alias-same-lots` | Hebrew category alias + price 900–1300 | results | same two lots |
| `strict-budget-no-result` | category + price 100–500 | unmatched, demand recorded | none |
| `approved-budget-relaxation` | category only | results, refinement `price` | `…121421`, `kedem-…88421`, `…121488` |
| `other-filter-approved-budget-kept` | price 100–500 only | unmatched, demand recorded | none |
| `strict-creator-no-result` | category + creator | unmatched (no committed lot has a creator yet) | none |
| `inverted-budget-sent-unchanged` | price min 1500 > max 900, unchanged | unmatched, demand recorded | none |
| `invalid-negative-budget` | rejected before the lots search | error `filters.price.min`, no demand | none |
| `invalid-sale-date` | rejected before the lots search | error `filters.dateRange.from`, no demand | none |
| `nothing-searchable` | nothing sent | insufficient criteria, no demand | none |

## Criteria and evidence

| Criterion | Evidence |
|---|---|
| Typed criteria map to the lots search | Every fixture scenario asserts the exact `SearchRequest` sent. |
| Budgets and strict filters survive refinement | Five-turn refinement test: budget tightened, another filter added, budget dropped once with approval, then sent again. The criteria returned always equal the criteria given. |
| No budget relaxation without permission | Across all scenarios, the sent budget equals the given budget unless `price` was approved. Approving another filter keeps the budget (`other-filter-approved-budget-kept`). |
| Invalid input | Negative budget, non-ISO currency, impossible date and date-with-time are rejected by the lots search's own DTO rules before any query (`lots-service-search.client.spec.ts`). An inverted budget is valid input and is sent unchanged, never "repaired" into a wider range. |
| Missing data | Whitespace-only keywords and a period or place the lots search cannot read are not sent; with nothing left, no search runs and no demand is recorded. |
| Deterministic behavior and ranking | Each scenario run twice gives identical requests, outcomes and progress. The order in which the buyer approved filters does not change the request. The hand-off keeps the lots search's order (newest sale, then lot id) and never re-ranks or adds lots. Ranking itself is owned and tested by the lots search. |
| Service failure | A lots database failure, a malformed lots response, a rejected request and a failed demand save each report the `error` progress stage, rethrow, and record no false demand. |
| Privacy | Demand records hold only the lead id, status, times and the search request: no contact or conversation fields. Progress updates carry no lot data. Rejection errors name fields, never the buyer's values. |
| Accessibility | Every outcome has a non-empty plain-text status (no markup) in the buyer's language, Hebrew or English. Rendering and assistive-technology checks belong to the chat and result-card screens. |
| No raw source reads | No file is read during any scenario; lots come only from the lots search. |

## Changes made to pass these checks

- `LotsServiceSearchClient` calls `LotsService` in-process, which previously bypassed the HTTP `ValidationPipe`. It now validates with the same `LotSearchDto`, so invalid values never reach SQL. It throws `InvalidLotsSearchRequestError`, naming the fields only.
- The orchestrator reports `no-results` only after the unmatched demand is saved. A failed save, or a lots response without a result list, now reports `error` instead of a false no-result.

## Known limitations

- No committed lot carries a `creator`, so any creator filter returns nothing until the auction data populates it.
- Budgets compare amounts as-is; there is no currency conversion (lots search rule).
- `statuses` is not sent yet; it waits for the buyer criteria to carry it.
