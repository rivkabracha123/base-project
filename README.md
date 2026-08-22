# Monabid Assistant

Standalone bilingual auction-assistant foundation for the Monabid junior development project.

**Project documentation:** https://monabid.giladweb.workers.dev/

## What this repository contains

This repository is the prepared development foundation, not the completed Monabid product. It gives the student team a working frontend, backend, database, shared contracts, tests, and deployment structure so they can begin with product features instead of assembling infrastructure.

The included sample route proves one complete path:

1. `fixtures/auction-data/lots.json` supplies a canonical auction lot.
2. A TypeORM migration creates the PostgreSQL table, and the seed command inserts the fixture.
3. NestJS returns the lot from `GET /api/lots/sample`.
4. The React application validates and displays it at `/sample`.
5. The item card links to the original auction source.

The repository does not yet implement the buyer and seller conversations, photo intake, auction search, comparable selection, valuation, lead capture, staff dashboard, hosted AI integration, complete fixture pack, approved branded component library, or public application deployment. Those are separate owner deliverables or student-owned features described in the [project documentation](https://monabid.giladweb.workers.dev/).

The private `.monabid-demo/` directory is reference material and is intentionally excluded from Git. Approved components must be reviewed and moved into `packages/ui` through the separate UI-kit deliverable rather than exposing the original design project.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker with Docker Compose

## Clean setup

```bash
npm install
cp packages/assistant-backend/.env.example packages/assistant-backend/.env
cp packages/assistant-client/.env.example packages/assistant-client/.env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

- Client: http://localhost:5173/sample
- API: http://localhost:3001/api
- Liveness: http://localhost:3001/api/health
- Readiness: http://localhost:3001/api/health/ready

The sample page is the thin vertical example:

```text
committed canonical lot → PostgreSQL migration/seed → NestJS endpoint
→ validated TanStack Query client → RTL-ready item card → exact source link
```

## Root commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the client and backend in watch mode |
| `npm run build` | Build all four packages |
| `npm run typecheck` | Type-check all packages |
| `npm test` | Run deterministic starter tests |
| `npm run fixtures:validate` | Validate committed canonical fixtures |
| `npm run db:migrate` | Apply pending TypeORM migrations |
| `npm run db:seed` | Idempotently load committed fixtures |
| `npm run db:reset` | Drop, migrate, and reseed the local database |

## Packages

- `packages/assistant-client`: React 18, Vite, React Router, TanStack Query, Tailwind, React Aria, and `react-i18next`
- `packages/assistant-backend`: NestJS, PostgreSQL, TypeORM, validation, health checks, structured HTTP logs, and local file storage
- `packages/shared`: source-neutral contracts and fixture schemas
- `packages/ui`: small RTL-ready foundation components; approved brand extraction remains a separate owner deliverable

## Safety and deterministic development

CI uses committed fixtures and PostgreSQL only. It does not call BidSpirit, Bright Data, Dibzel, hosted language models, file-storage services, or email providers. Never commit credentials, private conversations, real contact details, bidder data, consignor data, or customer uploads.

Local uploads belong under the ignored `.local-storage/` directory and are isolated by anonymous profile identifier.

## Documentation

The published project plan remains under `docs/`. Product and contract decisions are recorded in `docs/decisions.md`.
