# Staff Operations dashboard handoff

This document describes the staff dashboard as implemented in this repository:
what it reads, how to run it locally, how to diagnose it, and its intentional
limits. It contains no credentials, customer contact details, conversations,
or fixture payloads.

## Purpose and boundaries

The dashboard lets staff review safe summaries of buyer demand and seller
leads. It is not a CRM, an authentication system, or an outbound-contact tool.

P5 reads domain-owned projections only:

- Buyer unmatched demand is read through `UnmatchedDemandDbStore`, exported by
  `BuyerModule`, then adapted by
  `UnmatchedDemandBuyerLeadDashboardSource`.
- Seller list and detail are read through the seller-owned dashboard API
  contract. The list uses SellerLead UUIDs, never legacy staff-operation IDs.
- Browser code calls the assistant backend APIs; it never reads database tables.

The buyer adapter exposes only the original search request, strict constraints,
the no-result reason, and any later expansion. It intentionally supplies no
contact data and marks the record as read-only for the staff pipeline.

## Main paths

| Path | Responsibility |
| --- | --- |
| `packages/assistant-client/src/staff-operations/StaffOperationsDashboard.tsx` | Bilingual, RTL/LTR dashboard, filters, expandable lead detail, and pipeline UI. |
| `packages/assistant-client/src/app/api.ts` | Browser API calls and Zod validation of list and detail responses. |
| `packages/assistant-backend/src/staff-operations/staff-operations.service.ts` | Safe list/detail projection and manual pipeline validation. |
| `packages/assistant-backend/src/staff-operations/unmatched-demand-buyer-lead-dashboard.source.ts` | Buyer-owned unmatched-demand adapter. |
| `packages/assistant-backend/src/staff-operations/staff-operations.module.ts` | Wires the Buyer adapter as `BUYER_LEAD_DASHBOARD_SOURCE`. |

## API used by the browser

| Endpoint | Use |
| --- | --- |
| `GET /api/staff-operations/leads` | Safe lead summaries for the dashboard list. |
| `GET /api/staff-operations/leads/:leadId` | Buyer lead detail; unknown IDs return 404. |
| `GET /api/seller-leads/dashboard` | Safe Seller lead summaries with UUIDs used for detail requests. |
| `GET /api/seller-leads/:leadId` | Seller dashboard detail under the frozen seller contract. |
| `GET/PATCH /api/staff-operations/leads/:leadId/pipeline` | Pipeline status, next action, and concise notes for records that have a staff pipeline. |

## Local runbook

From the repository root:

```sh
npm run db:migrate
npm run dev
```

Open the exact Vite URL printed in the terminal (normally
`http://127.0.0.1:5173/staff-operations`). The backend normally runs on port
`3001`.

Smoke-check the list endpoint:

```sh
curl http://localhost:3001/api/staff-operations/leads
```

Run the focused checks before handoff:

```sh
npm run test --workspace=@monabid/assistant-backend -- staff-operations.service.spec.ts unmatched-demand-buyer-lead-dashboard.source.spec.ts staff-operations.module.spec.ts
npm run test --workspace=@monabid/assistant-client -- StaffOperationsDashboard.spec.tsx
npm run typecheck --workspace=@monabid/assistant-backend
npm run typecheck --workspace=@monabid/assistant-client
```

## Diagnosing

| Symptom | Likely cause and action |
| --- | --- |
| Browser shows `ERR_CONNECTION_REFUSED` | Start the Vite client and open the URL it prints. |
| Dashboard says leads could not be loaded | Start the backend, run `npm run db:migrate`, then inspect `GET /api/staff-operations/leads`. |
| The list endpoint returns 500 mentioning unmatched demand | The local database is behind migrations; run `npm run db:migrate` and restart the backend. |
| No buyer unmatched-demand records appear | No buyer no-result search has been persisted yet. This is an empty state, not an error. |
| A buyer demand has no manual pipeline controls | Expected: the demand has no `staff_operations` CRM row and is read-only. |
| Seller cards still use a legacy id | Merge S5 PR #124 (`cb3832c`) before testing. The new list endpoint replaces legacy seller cards with UUID-backed cards. |

## Privacy rules

- Never add contact details, consent evidence, verification codes, session IDs,
  signed URLs, full conversations, credentials, or opaque domain payloads to a
  dashboard list response.
- Contact data is displayed only when service consent allows it; Buyer unmatched
  demand contains no contact data by contract.
- Do not bypass domain modules with direct cross-domain table reads.
- Do not put real personal data or credentials in screenshots, logs, fixtures,
  documentation, commits, or pull requests.

## Known limits

- The dashboard has no production staff authentication or authorization.
- Buyer demand appears only after the Buyer flow records an actual no-result in
  `buyer_unmatched_demand`; an empty table produces no buyer demand cards.
- Buyer unmatched demand is read-only in the manual pipeline because it has no
  corresponding staff CRM record.
- Seller list/detail integration depends on S5 PR #124 (`cb3832c`), which
  supplies `/api/seller-leads/dashboard` and the legacy-ID resolver. Until it
  is merged into the team branch, the client deliberately falls back to the
  older staff seller rows; do not substitute those IDs for SellerLead UUIDs.
- Seller cards supplied by S5 are read-only in the staff Pipeline because the
  S5 dashboard contract does not provide a staff CRM pipeline mapping.
- The dashboard does not send email, assign staff, export CSV, schedule work,
  or run campaigns.
- The local dashboard is demonstration-oriented; it does not claim production
  availability or real-time external auction-house integration.
