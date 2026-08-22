# Local infrastructure

From the repository root:

```bash
docker compose up -d
docker compose ps
npm run db:migrate
npm run db:seed
```

Reset the local database with `npm run db:reset`. Stop services with `docker compose down`; add `-v` to also remove local database data.
