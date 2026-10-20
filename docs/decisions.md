# Monabid Assistant — confirmed product decisions

This file is the authoritative discovery record used to write the project plan. It distinguishes required MVP behavior from optional work.

## Purpose

Build a standalone conversational auction assistant that gives buyers and sellers useful auction evidence while converting qualified intent into structured, actionable data for Monabid.

The buyer journey is the primary traction path. The assistant must provide real value—structured understanding, source-backed results, comparable evidence, or an honest no-result explanation—before asking whether the visitor wants Monabid's manual help. Contact capture supplements the product; it never replaces the result.

The assistant is a separate, independently deployable application with explicit future adapters to Dibzel and external auction-data providers. It does not require Dibzel authentication, deployment, or database access. Dibzel remains authoritative for its users, auction houses, inventory, auctions, bidding, and existing sale results.

## Required buyer journey

1. The buyer starts anonymously in Hebrew or English.
2. The assistant captures the language as a profile preference and asks focused clarification questions.
3. It extracts structured criteria such as category, creator, period, format, budget, geography, keywords, and auction-house preferences.
4. It searches upcoming lots and historical sales through a canonical auction-data contract.
5. It presents ranked results with images, auction house, estimate or realized price, date, match reason, and source.
6. The buyer can inspect evidence, ask follow-up questions, and refine the search.
7. The buyer can open a lot-detail view with historical sale evidence, auction-house context, and a simple price-history visualization.
8. After receiving useful results or an honest no-result explanation, the buyer may ask Monabid for manual help and provide contact details and service-contact consent.
9. Qualified unmatched demand is visible to staff even though saved searches, automated alerts, scheduled matching, notifications, and email delivery are outside the reduced cycle.

## Required seller journey

1. The seller starts anonymously and uploads one or more photographs.
2. The assistant asks for missing evidence, including dimensions, condition, markings, signatures, provenance, and documents.
   An explicit Hebrew or English skip records the field as skipped but still missing; it does not count as evidence or satisfy a required-field gate for recommendations.
3. The seller reviews and corrects the structured item description.
   A corrected fact updates the draft immediately but is marked unconfirmed and excluded from confirmed-fact handoffs until the seller explicitly confirms it.
4. The system retrieves and ranks historical comparable sales.
5. It provides an indicative value range only when sufficient evidence exists.
6. It explains confidence, limitations, and how corrected facts affect the result.
7. It recommends one active Dibzel auction house and relevant alternatives using concrete evidence.
8. It drafts a catalog description.
9. It captures contact information and creates an internal Monabid seller lead.
10. It does not automatically contact an auction house or imply acceptance for consignment.

## Product boundary

The assistant may discover, explain, capture intent, create seller leads, and deep-link into Dibzel.

The MVP does not implement bidding, payments, bidder approval, KYC, completed consignments, or live-auction mutation. Those operations remain in Dibzel.

## Languages and progressive profiling

- Hebrew and English are required.
- Hebrew RTL and English LTR must both work.
- The assistant stores preferred language and preferred Hebrew grammatical form: masculine, feminine, neutral, or unspecified.
- It must not infer gender from a name or photograph.
- It should ask for a preferred name naturally and progressively collect useful information without presenting a registration form.
- Optional profile fields include email, phone, country, city, time zone, buyer/seller role, collector/dealer/institution/private-owner role, interests, budget, time horizon, preferred contact channel, and preferred contact time.
- Service consent and marketing consent are stored separately, even though marketing and notification delivery are outside this cycle.
- Nonessential questions can be skipped.

Minimum contact requirements:

- Browsing and receiving results: no contact information required.
- Buyer help request: preferred name, either email or phone, and explicit service-contact consent.
- Seller lead: preferred name, either email or phone, and explicit service-contact consent.

Marketing consent remains separate and is never required for service contact.

## Anonymous profiles without registration

The reduced cycle does not require registration, login, or email verification.

- A random browser/session identifier owns the anonymous profile.
- The profile may hold language, grammatical preference, preferred name, contact details, and separate consent fields.
- Users can review, update, and delete their current profile.
- No Dibzel account, password, login session, KYC record, or bidder identity is created.
- Demonstrations use synthetic contact information.
- Future email verification, Dibzel authentication, and profile linking are outside the reduced cycle.

## Consent, retention, and privacy

- Service-contact and marketing consent records include timestamp, channel, and policy version; they remain separate.
- Users can withdraw consent and request deletion.
- Submitted leads remain until deletion.
- Users can delete the current anonymous profile and its unsubmitted local evidence.
- One user's profile, conversation, or uploads must never be exposed to another user.
- Private contact data and full conversations must not appear in ordinary logs.
- Public demonstrations use synthetic contact information and seller evidence. Protected Dibzel staff authentication and automated retention are future integrations.

## Auction data and category support

Support is evidence-driven rather than hard-coded to a fixed category list.

- Buyer search supports categories represented in the seeded dataset.
- Seller intake accepts any category.
- Numerical valuation is available only when the evidence threshold is met.
- Unsupported or weakly supported items still become seller leads without an invented range.
- A week 1 coverage review classifies categories as strong, limited, or unsupported after the real dataset arrives.

Data access:

- A sanitized, versioned fixture dataset is the required student data source.
- The project owner supplies a provisional, sanitized BidSpirit snapshot for development; it is not the permanent schema or production ingestion path.
- The project owner evaluates a representative Bright Data sample before the end of Week 1. Bright Data, BidSpirit, and future Dibzel adapters must map into source-neutral canonical contracts.
- Students do not investigate undocumented external APIs, hold external credentials, or make tests depend on live providers.
- Live external refresh is not required for student CI or fixture-backed demonstrations.
- Direct Dibzel database access is prohibited, and CI never calls Dibzel, Bright Data, BidSpirit, or Monabid production services.
- P1 owns canonical import, validation, stable source identifiers, source lineage, idempotency, and repeatable fixture refresh.

The dataset must contain stable IDs, auction houses, categories, lots, source links, multilingual text where available, images or permitted references, estimates, original currencies, auction dates, sale status, and realized prices. It must contain no bidder, consignor, or customer PII.

The benchmark dataset must support at least three buyer searches, two seller examples with six plausible realized comparables each, one insufficient-evidence example, and multiple auction houses.

## Search and comparable matching

Search is deterministic-first and free of mandatory paid services.

- PostgreSQL full-text and partial-text search.
- Structured filters for category, creator, period, medium, auction house, date, geography, currency, and price.
- Curated Hebrew/English aliases for important auction terms.
- Explainable deterministic ranking.
- Optional local embeddings only as a stretch improvement.

Comparable scoring may use category, subtype, creator, period, medium, material, edition, technique, dimensions, condition, provenance, recency, metadata completeness, and realized-price availability. The UI displays concise match reasons.

## Valuation policy

Every valuation is an indicative auction estimate, not a certified appraisal or guaranteed sale price.

- Require at least three credible realized-price comparables for a numerical estimate.
- Preserve every original price and currency.
- Normalize into USD using a dated exchange-rate record; allow ILS display.
- Fixture mode uses committed exchange-rate fixtures.
- Unsold-lot estimates are context, not realized value.
- Do not apply speculative inflation or market-growth adjustments in the MVP.
- Use a deterministic, versioned calculation with recorded comparables, weights, exchange rates, outlier treatment, and confidence.
- Show low, medium, or high confidence and explain what affects it.
- Recalculate after material seller corrections.
- Refuse unsupported numerical precision.
- AI may explain the result but may not invent prices, sources, or comparables.

## Auction-house recommendations

- Recommend only active auction houses represented in prepared canonical data; retain Dibzel identifiers when available for future integration.
- Rank using available evidence such as category specialization, comparable performance, geography, language, and recent activity.
- Do not claim commission, shipping, acceptance, or other facts unless current data supports them.
- Show one recommendation and relevant alternatives with reasons.
- Allow the seller to choose a different house.
- Save the recommendation, alternatives, explanation, and seller choice in the lead.
- Do not automatically send the lead externally.

## AI policy

A real hosted LLM is required without making paid usage mandatory.

- During project preparation, the project owner selects a suitable free model exposed through an OpenAI-compatible endpoint. The [awesome-freellm-apis directory](https://github.com/open-free-llm-api/awesome-freellm-apis) may be used to find candidates.
- Students receive the selected base URL, model identifier, API-key configuration, and permitted usage. They do not survey providers.
- P4 builds one configurable server-side OpenAI-compatible adapter and a deterministic fixture provider for tests.
- P4 performs a limited Hebrew/English structured-output smoke test against the selected provider.
- Structured output is schema-validated; invalid, unavailable, or rate-limited responses retry or fall back to guided input.
- CI and automated tests never call the hosted provider.
- Contact information and uploaded images are not sent to the model during this cycle.
- Search, comparable ranking, currency normalization, valuation, and confidence remain deterministic.
- Runtime prompts are versioned files with schemas, examples, safety rules, and recorded fixtures.

## Channel

- The complete required product is a web application.
- Conversation contracts support text, local image references, structured cards, and action links.
- No other messaging channel is part of the reduced cycle.

## Internal dashboard

A protected production dashboard is required eventually; the junior-cycle dashboard uses synthetic data until staff authentication is integrated.

Required features:

- Buyer and seller lead lists using synthetic demonstration data during the junior cycle.
- Filters for lead type, status, category, and date.
- Buyer criteria, results shown, unmatched demand, conversation summary, contact details, and consent evidence.
- Seller confirmed item, evidence, comparables, valuation or refusal, recommendation, catalog draft, and lead history.
- A small manual pipeline with status changes, status history, a concise next action, and short activity notes. The initial statuses are `new`, `reviewing`, `contacted`, `qualified`, `item_found`, `negotiating`, `won`, `lost`, and `closed`; Miryam confirms valid transitions before the Week 1 contract freeze.
- Empty, error, privacy, responsive, and bilingual states.

It is not a full CRM and does not include advanced analytics, CSV export, automated assignment, task scheduling, outbound campaigns, or production staff authorization.

## Technology and repository

Backend:

- NestJS, TypeScript, PostgreSQL, TypeORM migrations, DTO validation, and clear application-service boundaries.
- No microservices, CQRS framework, broker, scheduled worker, generic repository layer, or separate worker deployment.

Frontend:

- React 18, TypeScript, Vite, Tailwind, React Router, TanStack Query, React Aria, and `react-i18next`.
- The project owner supplies approved Monabid assets and the RTL-compatible Untitled UI subset extracted from Dibzel.
- The project owner supplies approved data-only visual primitives. Supplied components do not define search, valuation, recommendation, privacy, or persistence behavior.
- The vendored UI is versioned; changes require Miryam's approval.

Storage:

- The reduced cycle uses `LocalFileStorage` with an ignored directory and profile-isolated access.
- The public demonstration uses synthetic evidence under a deployment arrangement prepared by the project owner.
- Tests use temporary directories or fixtures.
- R2, signed URLs, and automated lifecycle cleanup are future integrations.

Integration:

- Browser code calls only the assistant backend.
- The backend maps prepared BidSpirit and Bright Data snapshots into source-neutral assistant contracts.
- Students receive versioned snapshots, not provider credentials. Any future live provider runs server-side behind the same adapter boundary.
- Future Dibzel integration uses an API adapter and retained source references, never shared database tables.

Proposed repository shape:

```text
monabid/
├── docs/
├── prompts/
│   ├── shared/
│   ├── buyer/
│   ├── seller/
│   └── evaluations/
├── fixtures/
│   ├── auction-data/
│   ├── ai-responses/
│   └── demo-scenarios/
├── infra/
│   ├── docker-compose.yml
│   └── README.md
├── packages/
│   ├── assistant-client/
│   ├── assistant-backend/
│   ├── shared/
│   └── ui/
└── package.json
```

## Deployment and operations

- Product frontend and implementation-plan documentation: Cloudflare Pages.
- Backend: Render web service.
- Database: Render PostgreSQL.
- CI/CD: GitHub-based automatic builds and deployments.
- Local database: PostgreSQL through Docker Compose.
- The project owner handles public deployment. Student code supplies fixture-mode configuration, structured logs, health/readiness endpoints, and safe adapter outcomes.
- Production monitoring, domains, secrets, and support ownership are future integration work.

## Team and timeline

- Eight-week cycle.
- Fourteen junior developers: five in Data and Platform, four in Buyer, and five in Seller.
- One team leader for all groups: Miryam.
- Groups: Make the Application Work; Help Buyers Find an Item; Help Sellers Understand and Submit an Item.
- Buyer result-list and item-detail ownership is combined under B4 because those screens consume the same contract and begin from prepared visual components.
- Developer display names remain `Developer 1` through `Developer 5` until supplied.
- Stable IDs and one JSON file per developer under `docs/data/developers/` supply names, assignments, weekly descriptions, verification prompts, and required product-context blocks for all 112 tasks. `docs/shared.js` only loads, validates, and renders this data.
- Week 1 is for explaining each feature, reviewing the prepared environment, drawing the flow, agreeing on boundaries, and checking direction. No feature implementation is required.
- Core shared contracts are agreed at the end of Week 1. Later changes require Miryam's approval and name the affected students.
- Week 2 produces the smallest visible fixture-backed version of every owned feature.
- Week 3 adds the main behavior; Week 4 adds only the minimum cross-feature integration; Week 5 completes required behavior.
- Week 6 tests failures, privacy, accessibility, and deterministic behavior.
- Week 7 focuses on usability and handoff. Week 8 introduces no substantial new features.
- Cross-team collaboration is limited to agreeing on the minimum contract, supplying a fixture or mock, completing one integration test, and resolving integration failures.
- Every student remains individually responsible for her feature's code, tests, documentation, and demonstration.

## Verification

- Weekly goals and acceptance criteria for every developer.
- Deterministic fixtures for every required feature.
- Unit tests for domain logic and parsing.
- Integration tests for database and adapter boundaries.
- Contract tests for prepared BidSpirit and Bright Data snapshot adapters.
- End-to-end buyer, seller, and staff-operation journeys.
- No required CI test calls Dibzel, Bright Data, BidSpirit, a hosted LLM, external file storage, or email.
- Every feature card states the user value, exact screens or services to build, inputs, outputs, dependencies, exclusions, completion evidence, and acceptance scenario. Students do not derive their assignment from a title or verification prompt.
- Every feature card also includes a copyable verification prompt.
- From week 2, the verification report goes into the PR description.
- Miryam reviews the report with the code.

## Definition of done

Buyer demonstration:

- Anonymous bilingual conversation, clarification, structured criteria, ranked current/historical results, refinement, result cards, and a lot-detail view with historical price evidence.
- The buyer receives useful results before an optional request for Monabid's manual help. A separate no-result scenario records qualified unmet demand without pretending inventory exists.

Seller demonstration:

- Anonymous bilingual intake, multiple uploads, seller corrections, comparable evidence, indicative range and confidence, scenario question, auction-house recommendation, catalog draft, contact capture, and internal lead creation.

Internal demonstration:

- Find buyer and seller leads, inspect the value already delivered, verify contact permission, record a next action or short activity note, update lead status, and demonstrate an insufficient-evidence refusal.

The deployed system must also work in fixture mode and include operational handoff documentation.

## Future work

The reduced cycle does not schedule stretch work. Saved searches, automated alerts, email verification and delivery, R2 storage, automated retention, Dibzel login/profile linking, live external-source refresh, image interpretation, WhatsApp, browser push, digests, production staff authorization, and full production operations can be considered after the required application is complete.

## Project-owner supplied inputs

`docs/deliverables.html` lists five consolidated inputs the project owner ensures are available. Domain learning and the fourteen developer assignments are part of this plan itself, not external resources supplied by the owner.

The team receives five consolidated inputs:

1. **Prepared implementation repository:** one npm-workspaces repository containing the React/Vite starter, NestJS starter, initial shared TypeScript package, Docker Compose PostgreSQL, environment examples, root commands, starter tests, CI, and pull-request template.
2. **Approved Monabid UI package:** extracted logo, brand tokens, RTL-ready primitives, and approved customer and staff components placed inside the new repository. Students do not extract these foundations themselves.
3. **Auction data and benchmark fixture pack:** sanitized canonical auction fixtures, exact source lineage, the representative Bright Data sample and mapping decision, named buyer and seller scenarios, synthetic evidence and contact data, and dated exchange-rate fixtures.
4. **Selected OpenAI-compatible service access:** the project owner selects a candidate, potentially using the [awesome-freellm-apis directory](https://github.com/open-free-llm-api/awesome-freellm-apis), and supplies the base URL, model identifier, environment-variable names, known limits, decision record, and credentials through a secure channel.
5. **Prepared deployment environments:** Cloudflare Pages, Render backend, Render PostgreSQL, protected environment configuration, health checks, and the public fixture-backed application URL. This input is needed when integrated deployment begins.

The AI ownership decision remains unchanged: provider research and final selection belong to the project owner; P4 performs the limited Week 1 Hebrew/English structured-output smoke test and then owns the adapter, schema validation, deterministic fixture provider, retry, outage behavior, and guided fallback. B2 and S1 own their domain instructions and behavior. The project owner does not supply an AI implementation.

Each deliverable link is initially `null` in `data/deliverables.json`. The project owner adds the repository path or deployed URL when the consolidated input is ready. Secrets and provider credentials are never placed in a public link.
