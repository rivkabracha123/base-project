# Lots search handoff and taxonomy

The search code lives in `packages/assistant-backend/src/lots/`. A bare file name below (such as `lots.service.ts`) is in that folder; any other path is from the repository root.

## 1. What this is

Every auction lot carries a few classification fields. Each holds a fixed, English token such as `rare_books`, so lots can be filtered and compared by exact value. This file describes those fields, how a buyer's wording becomes a token, and how to extend the vocabulary.

Two consumers rely on the tokens:

- Buyer search (`lots.service.ts`) filters lots by exact token.
- Comparable selection (`packages/assistant-backend/src/comparables/comparable-score.ts`) reads lots directly and compares `lot.category` with the seller item's category by exact string equality. It does not use the alias lookup, so the item's category must already be a token.

## 2. Classification fields

The shape of a lot is defined in `packages/shared/src/auction-lot.ts`; this table adds only what that schema does not say.

| Field | Search filter | Curated Hebrew/English aliases |
|---|---|---|
| `category` | `categories` | yes |
| `creator` | `creators` | yes |
| `period` | `periods` | no |
| `medium` | `media` | no |
| `geography` | `geography` | no |
| `itemKey` | not a search filter | no |

A token is lowercase letters and digits joined by single underscores (`^[a-z0-9]+(?:_[a-z0-9]+)*$`). Spaces, capitals and non-ASCII text are rejected by the schema. `itemKey` links lots that are the same item sold more than once.

## 3. How a phrase becomes a token

The lookup lives in `lot-alias.ts`.

1. Category and creator only: the phrase is trimmed and lowercased, then looked up in `lot-aliases.json`. A Hebrew and an English phrase for the same concept resolve to one token (for example `ספרים נדירים` and `Rare Book` both resolve to `rare_books`).
2. If there is no alias, an English phrase is rewritten to token form: lowercased, spaces and hyphens turned into underscores (`Old Maps` becomes `old_maps`).
3. If the result is not a valid token (any Hebrew text, for example), nothing is resolved.
4. Period, medium and geography have no alias table, so only step 2 applies to them.

A value that could not be resolved is used as sent. The filter stays strict: it matches only lots whose field equals that exact value, so an unresolved Hebrew value returns no lots. It is never dropped.

When a search returns no lots, the response includes `unrecognizedFilters`: the values, as sent, whose token exists on no lot at all. It is absent when the result is not empty.

## 4. Adding a category or creator

1. Add an entry to `lot-aliases.json` under `categories` or `creators`: the token as the key, and the `en` and `he` phrase lists.
2. The token must equal the value stored on the lots. An alias only gives a new name to an existing token; it does not change the data.
3. A phrase may not point to two different tokens. The service throws at startup if it does.
4. An alias must name the same category, never a broader or narrower one, so that a buyer's constraint keeps its meaning.

## 5. Runbook

### Run the tests

From the repository root, build the shared libraries once, then run the search suites from the backend package:

```sh
npm run build:libs
cd packages/assistant-backend
npx jest src/lots
```

### Run a search against the local database

From the repository root:

```sh
docker compose -f infra/docker-compose.yml up -d    # PostgreSQL on port 5432
cp packages/assistant-backend/.env.example packages/assistant-backend/.env   # first time only
npm run db:migrate
npm run db:seed        # loads fixtures/auction-data/lots.json
npm run dev:backend    # listens on PORT from .env (3001 by default)
```

Docker Desktop must be running before `docker compose`. If the database already holds lots from another version of the file, run `npm run db:reset` instead of `db:seed`: it drops every table, migrates and seeds again. It prints every SQL statement; the last line should be `Seeded N auction lot(s).`

Then send a search:

```sh
curl -X POST http://localhost:3001/api/lots/search \
  -H "Content-Type: application/json" \
  --data-binary @body.json
```

with `body.json`, for example:

```json
{ "query": "abrabanel", "filters": { "categories": ["ספרים נדירים"], "price": { "max": 1500, "currency": "USD" } } }
```

Keep Hebrew in a UTF-8 file as above; Hebrew typed inline after `curl -d` in Git Bash on Windows can arrive garbled.

### Request and response

- Request (`lot-search.dto.ts`): `query`, `language`, `page` (default 1), `limit` (default 10) and `filters`. `language` is validated but does not change the search. Unknown keys are rejected.
- Response (`lot-match.ts`): `data` (each item is `lot` plus `matchReasons`), `total`, `page`, `limit`, `totalPages`, and `unrecognizedFilters` on an empty result only.

### Diagnosing

| Symptom | Likely cause | Where to look |
|---|---|---|
| `400` with a list of messages | The body broke a request rule: unknown key, `null` field, negative amount, non-ISO currency, impossible date, or `min must not be greater than max`. | `lot-search.dto.ts` |
| Empty result with `unrecognizedFilters` | A sent value exists on no lot, for example a Hebrew period, medium or place. | Section 3 |
| Empty result without `unrecognizedFilters` | Every value exists somewhere, but no lot matches all filters together, or fewer than half of the query words (rounded up) match. | `lots.service.ts` |
| A lot within budget is missing | A lot with a realized price is matched on it, not on its estimate; a lot with neither a realized price nor an estimate is excluded when a price filter is sent. | Price window in `lots.service.ts` |
| The database holds lots that are not in `lots.json`, or misses new ones | It was seeded from another version of the file. `db:seed` adds and updates by lot id and never deletes. | `packages/assistant-backend/src/database/seed.ts`; `npm run db:reset` drops every table, then migrates and seeds again |
| `500 Internal server error` | Database failure. The response never carries the cause; it is in the server log only. | `packages/assistant-backend/src/common/http-exception.filter.ts` |

## 6. Search fields and filters

| Request field | Lot field | Rule | Aliases |
|---|---|---|---|
| `query` | `title` and `description`, English and Hebrew | Split into words; stop words, punctuation-only words and repeats are dropped. Each word matches by partial text or PostgreSQL full-text search. A lot is returned when at least half of the words (rounded up) match. | None; a word matches only text in its own language. |
| `filters.categories` | `category` | Equals any sent value. | Yes (section 3) |
| `filters.creators` | `creator` | Equals any sent value. | Yes (section 3) |
| `filters.auctionHouseIds` | `auctionHouse.id` | Equals any sent id. | No |
| `filters.periods` | `period` | Equals any sent value. | English token form only |
| `filters.media` | `medium` | Equals any sent value. | English token form only |
| `filters.geography` | `geography` | Equals any sent value. | English token form only |
| `filters.statuses` | `status` | Equals any sent value; only `sold`, `unsold`, `upcoming`, `withdrawn` and `unknown` are accepted. | No |
| `filters.dateRange` | `saleDate` | `from` and `to` are inclusive `YYYY-MM-DD` dates; either may be left out. | No |
| `filters.price` | `realizedPrice`, else `estimate` | Inclusive. A lot with a realized price is matched on it; otherwise its estimate band must overlap the range; a lot with neither is excluded. `min` above `max` is rejected. `currency` is not used to convert or exclude. | No |

How they combine:

- Every sent filter must match; within one list filter, any of its values is enough.
- Filters are strict: a sent filter is never dropped or widened. Ranking only orders lots that already passed every filter.
- Order: most matched query words first, then the newest sale date, then lot id, so the same request always returns the same order.
- Every result carries `matchReasons`: one per matched query word, and one per sent filter: the list value it matched (as sent), the date window, or `realized` / `estimate` for the price.
- A request with no usable word and no filter returns an empty page without querying the database.

## 7. Demo values snapshot

Taken on 2026-10-20 from `fixtures/auction-data/lots.json` (16 lots, all labelled `bidspirit-snapshot`). It describes the frozen demo data, not every value the search can ever see; refresh it when the file changes by reading the distinct values of each field in the file.

| Field | Values (lots) | Lots without it | Has aliases |
|---|---|---|---|
| `category` | `rare_books` (16) | 0 | yes |
| `creator` | `yitzhak_abrabanel` (7) | 9 | yes |
| `period` | `16th_century` (10), `18th_century` (2) | 4 | English token form only |
| `medium` | `printed_book` (10), `parchment_manuscript` (4), `parchment_scroll` (2) | 0 | English token form only |
| `geography` | `italy` (12), `ashkenaz` (2) | 2 | English token form only |
| `status` | `sold` (11), `upcoming` (5) | 0 | no |
| `auctionHouse.id` | `house-kedem` (7), `house-kestenbaum` (6), `house-tiroche` (3) | 0 | no |

Other facts that affect searches: every lot has an English and a Hebrew title and description; `itemKey` groups the lots into 6 items that were sold more than once; all prices are in USD; sale dates run from 2016-06-08 to 2027-01-15.

### Demo searches

Run each body with the `curl` command in section 5. The results below were measured on 2026-10-20 against a database reset from this file; if the file changes, run them again and update the results.

| # | Request body | Shows | Result |
|---|---|---|---|
| 1 | `{ "query": "מגילת אסתר", "filters": { "price": { "max": 78000, "currency": "USD" } } }` | Hebrew free text with a strict budget | 1 lot: `lot-history-esther-kedem-2024` (realized 75000). The upcoming scroll with an estimate of 80000-100000 is excluded although its text matches. |
| 2 | `{ "query": "Abrabanel commentary", "filters": { "creators": ["יצחק אברבנאל"] } }` | Hebrew creator alias, the half-of-the-words rule and the order | 7 lots: the three "Commentary on the Latter Prophets" lots (both words), newest first, then the four "Atereth Zekeinim" lots (one word), newest first. |
| 3 | `{ "filters": { "periods": ["18th century"], "geography": ["Italy"] } }` | English values rewritten to tokens without a dictionary | 2 lots: `lot-kedem-esther-scroll-2026`, `lot-history-esther-kedem-2024`. |
| 4 | `{ "filters": { "periods": ["המאה ה-18"] } }` | An unsupported Hebrew period gives an honest empty result | 0 lots, with `unrecognizedFilters: { "periods": ["המאה ה-18"] }`. |

## 8. Known limits

1. The alias dictionary is maintained by hand: a new category or creator needs its phrases added to `lot-aliases.json` (section 4).
2. Period, medium and geography have no Hebrew aliases; a Hebrew value matches no lot. This is a team lead decision for this cycle.
3. Free text does not cross languages: a Hebrew word finds only Hebrew text, an English word only English text.
4. The "at least half of the words" threshold is a chosen and approved rule, not the result of measuring relevance. Every word weighs the same.
5. Partial-text matching can add noise: a short word also matches inside a longer word.
6. There is no currency conversion, and currency does not filter: amounts are compared as numbers. This is a team lead decision for this cycle.
7. Every search reads all lots; there is no index. Adding one would require restructuring the query, since partial-text matching and the matched-word count cannot use a standard index.
8. `null` in a list filter or in `dateRange` is not rejected; it behaves as if that filter was not sent.
