# Monabid Assistant — developer/week matrix

This matrix assigns fourteen junior developers: five in Data and Platform, four in Buyer, and five in Seller. Each developer owns one coherent feature, its tests, fixtures, documentation, and demonstration.

A feature title is not an assignment. Every team HTML page contains the complete assignment: user value, exact screens or services, inputs, outputs, dependencies, exclusions, completion evidence, acceptance scenario, and a description and verification for each of the eight weekly tasks.

The eight-week rhythm is shared by everyone:

1. **Week 1 — Explain:** understand the feature, inspect assigned BidSpirit examples, draw the flow, define inputs/outputs, and agree on boundaries. No feature coding is required.
2. **Week 2 — Start:** build the smallest visible working version with prepared fixtures.
3. **Week 3 — Build:** add the main behavior.
4. **Week 4 — Connect:** complete only the minimum required integration with other features.
5. **Week 5 — Complete:** finish the user-facing feature.
6. **Week 6 — Test:** cover mistakes, missing data, privacy, accessibility, and service failures.
7. **Week 7 — Prepare:** improve usability and write the handoff.
8. **Week 8 — Demonstrate:** show the owned feature inside the complete application without adding substantial scope.

## Team 1: Make the application work

| Student | What she owns | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 |
|---|---|---|---|---|---|---|---|---|---|
| **Developer 1 (P1)** | Canonical auction-data ingestion and source lineage | Explain prepared sources, canonical shapes, and rejected data | Import houses and lots from a prepared snapshot | Add auctions, results, original money, source IDs, and lineage | Validate records and connect P2/S3 to canonical data | Finish idempotent import and fixture refresh | Test duplicates, changes, missing fields, PII, and larger fixtures | Freeze demo data and write the data handoff | Demonstrate a source snapshot becoming traceable canonical data |
| **Developer 2 (P2)** | Hebrew/English auction search, filters, ranking, and match reasons | Explain searchable fields, strict filters, and benchmark queries | Search fixture lots by basic text | Add category, creator, date, house, status, and price filters | Add aliases and connect the search API to B3 | Finish deterministic ranking, pagination, and match reasons | Test weak data, unsupported searches, strict budgets, and measured fixtures | Tune benchmark searches and document taxonomy | Demonstrate bilingual searches with preserved constraints |
| **Developer 3 (P3)** | Anonymous profile, contact details, consent, review, and deletion | Explain anonymous ownership, progressive contact, consent, and deletion | Create isolated profiles with language preference | Add name, grammatical form, contact, and separate consent fields | Connect the minimum fields needed by Buyer, Seller, and dashboard | Add review, update, deletion, and consent evidence | Test isolation, unsafe logs, invalid sessions, and deletion | Write privacy/profile handoff | Demonstrate two visitors whose information never crosses |
| **Developer 4 (P4)** | Configurable AI provider, validated output, and guided fallback | Explain safe inputs, schemas, fixture provider, and fallback | Build configurable real and deterministic fixture providers | Validate structured buyer answers in Hebrew and English | Validate seller answers and connect B2/S1 | Add retry and guided fallback for invalid or unavailable responses | Test malformed output, outages, limits, and measured fixtures | Document provider configuration, prompts, and fallback | Demonstrate both real AI and provider-unavailable journeys |
| **Developer 5 (P5)** | Staff operations dashboard and manual lead pipeline | Explain what staff review, privacy limits, statuses, and next actions | Build dashboard shell and buyer/seller lead lists | Show buyer criteria, shown results, unmatched demand, contact, and consent | Show seller item, evidence, comparables, valuation/refusal, and catalog draft | Add filters, status history, next action, and short activity notes | Test empty, error, privacy, larger fixtures, and transition history | Improve responsive bilingual presentation and write handoff | Demonstrate staff operating buyer and seller leads |

### Team 1 boundaries

- P1 receives prepared snapshots. She does not discover or purchase data sources.
- P2 owns general search. B3 owns how buyer criteria use that search.
- P3 owns shared profiles, contact, and consent, not Buyer or Seller business behavior.
- P4 owns provider connection and schema validation. B2 and S1 own domain instructions and state.
- P5 consumes dashboard-facing Buyer and Seller APIs and never reads their tables directly.

## Team 2: Help buyers find and investigate items

The buyer flow has four developers because result lists and item details consume the same contract and begin from supplied visual components. This removes an integration boundary without reducing buyer scope.

| Student | What she owns | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 |
|---|---|---|---|---|---|---|---|---|---|
| **Developer 1 (B1)** | Bilingual buyer conversation interface | Explain conversation, typed messages, keyboard flow, and supplied component boundaries | Build basic anonymous Hebrew/English chat | Add history, input, pending, retry, and keyboard states | Add RTL/LTR switching and connect B2/B3 messages | Finish complete buyer flow and typed result rendering | Test mobile, accessibility, long conversations, errors, and switching | Improve copy and write frontend handoff | Demonstrate complete bilingual buyer conversation |
| **Developer 2 (B2)** | Persistent buyer-intent understanding, questions, and corrections | Explain criteria, useful questions, and facts that must remain | Extract a basic structured request from a fixture response | Ask focused questions for missing budget, category, creator, period, or location | Update criteria across turns without erasing earlier constraints | Finish review, correction, skipped questions, and guided fallback | Test bilingual, conflicting, missing, removal, and preserved-constraint cases | Refine prompts and document intent contract | Demonstrate a vague request becoming accurate reviewable criteria |
| **Developer 3 (B3)** | Criteria-to-search orchestration, explanations, and unmatched demand | Explain boundary between buyer criteria and P2 search | Convert criteria into a typed search request | Preserve budgets and hard filters through refinement | Add match explanations, current/history grouping, and safe no-result recovery | Finish orchestration, approved relaxation, and unmatched-demand capture | Test strict constraints, no results, repeated refinement, and deterministic ranking | Tune benchmarks and write orchestration handoff | Demonstrate why results match and why a no-result request is still useful |
| **Developer 4 (B4)** | Result cards, item details, price evidence, source navigation, and optional help conversion | Explain all evidence a buyer sees before following a source or requesting help | Build responsive result cards and basic item detail from fixtures | Add result groups, original prices/currencies, history, and chart | Add source evidence, preserved navigation, RTL/LTR, keyboard, mobile, and broken-image behavior | Finish results-to-detail-to-help flow using B3/P3 contracts | Test unusual prices, missing history/images, broken sources, accessibility, and restored search state | Polish evidence presentation and write handoff | Demonstrate discovery, comparison, investigation, and post-value conversion |

### Team 2 boundaries

- B1 owns presentation of the conversation; B2 owns understanding and revising criteria.
- B3 calls P2 and never reimplements general search.
- B4 displays only validated B3/P1 data and never invents item history or prices.
- Contact is optional and requested only after useful results or a useful no-result explanation.
- Saved searches, automated alerts, scheduled matching, notifications, and email delivery remain outside the cycle.

## Team 3: Help sellers understand and submit an item

| Student | What she owns | W1 | W2 | W3 | W4 | W5 | W6 | W7 | W8 |
|---|---|---|---|---|---|---|---|---|---|
| **Developer 1 (S1)** | Seller conversation, confirmed facts, corrections, revisions, and catalog draft | Explain seller journey, evidence states, correction, and safety wording | Build bilingual intake that creates a draft item | Ask for condition, dimensions, marks, signatures, and provenance | Let seller review/correct facts using S2 evidence references | Finish revision, recalculation trigger, and confirmed-fact catalog draft | Test bilingual, skipped, conflicting, unsupported, and insufficient-evidence cases | Refine wording and write intake handoff | Demonstrate uncertain details becoming confirmed facts |
| **Developer 2 (S2)** | Safe profile-isolated local photo evidence | Explain file safety, ownership, and local-storage boundary | Upload multiple images with metadata and previews | Add ordering, deletion, retry, and clear states | Connect evidence gallery to S1 item revisions | Finish file limits, safe names/types, and isolated access | Test invalid files, storage failure, deletion, traversal, and cross-profile access | Improve upload UX and write storage handoff | Demonstrate safe upload, arrangement, viewing, and removal |
| **Developer 3 (S3)** | Deterministic comparable selection, credibility, and explanations | Explain credible comparables and scoring inputs | Build comparable query and scoring scaffold | Rank credible realized sales with match and exclusion reasons | Build evidence cards and connect selected evidence to S4 | Finish sparse-data, outlier-candidate, and inclusion/exclusion behavior | Test stable ranking, weak matches, unsold lots, and reviewed benchmarks | Document method and known limits | Demonstrate strong, weak, included, and excluded comparables |
| **Developer 4 (S4)** | Versioned indicative valuation or expert-review refusal | Explain formula, original currencies, FX, confidence, and refusal | Build versioned calculation with deterministic tests | Add dated currency conversion and weighted range | Build evidence report, confidence, limitations, and refusal below three credible sales | Add recalculation after corrections and scenario comparison | Test outliers, missing FX, insufficient evidence, stale revisions, and reproducibility | Document method and safety limits | Demonstrate supported range and honest refusal |
| **Developer 5 (S5)** | Auction-house fit, seller choice, contact/consent, and internal enquiry | Explain recommendation evidence, contact requirements, and status | Build draft internal enquiry API with contact and service consent | Rank active houses using supported evidence | Build recommendation, alternatives, and seller-choice screens | Add catalog draft review and create final internal lead | Test unsupported claims, missing contact, seller override, refusal, and dashboard integration | Document recommendation and lead workflow | Demonstrate useful evidence becoming a complete Monabid enquiry |

### Team 3 boundaries

- S1 owns seller-confirmed facts; S2 owns files, not conclusions about images.
- S3 selects comparables; S4 calculates from selected evidence.
- S5 creates an internal Monabid enquiry and never contacts an auction house automatically.
- Weak evidence never blocks lead creation, but it does block unsupported numerical valuation.
- No seller feature claims certified appraisal, guaranteed sale price, or image interpretation.

## Project-level progression

| Week | Expected visible result |
|---|---|
| **W1** | Fourteen explicit feature directions, contracts, fixtures, and failure cases are reviewed. The project owner prepares the working starter. No feature coding is required. |
| **W2** | The smallest visible version of all fourteen features works with prepared fixtures. |
| **W3** | Buyer understanding/search and seller comparable/valuation evidence have their main behavior. |
| **W4** | Minimum contracts and integration tests connect buyer, seller, profile, data, and dashboard journeys. |
| **W5** | All fourteen required user-facing features are complete. |
| **W6** | Failure, privacy, accessibility, deterministic, and end-to-end tests pass. |
| **W7** | Experience, documentation, fixtures, and operational handoff are ready. |
| **W8** | Each developer demonstrates her owned feature inside the public fixture-backed application. |
