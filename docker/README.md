# Local production and staging databases

Start both PostgreSQL 17 containers:

```bash
npm run db:up
```

| Environment        | Compose service | Host port | Database   | Named volume        |
| ------------------ | --------------- | --------- | ---------- | ------------------- |
| Production (local) | postgres        | 5432      | nest       | postgres_data       |
| Staging            | postgres-stage  | 5433      | nest_stage | postgres_stage_data |
| API tests          | postgres-stage  | 5433      | nest_test  | postgres_stage_data |

Both bind to `127.0.0.1` and use local-only credentials `nest`/`nest`.
Each database container has independent storage. A third, lightweight cron
container refreshes staging from production every day at **03:00 UTC**.
These are local environment simulations, not a deployed production setup.

## Scheduled production-to-staging refresh

`npm run db:up` also starts the `stage-refresh` cron container. It takes a
consistent snapshot of `postgres/nest` using `pg_dump`, restores it into a
scratch database on `postgres-stage`, then replaces `nest_stage` with the
restored database. Staging remains writable between refreshes. This copies
database state, not HTTP requests or reads; changes arrive at the next refresh.

**Every refresh discards staging-only data and disconnects staging clients.**
Schedule it while the staging app is idle; restart the staging app afterwards
if its connection pool does not recover. `nest_test` is never replaced.
The local production database is only read. Data is copied without masking.

Run immediately or inspect cron output:

```bash
npm run db:refresh:stage
docker compose logs stage-refresh
```

The cron process checks every minute and on container startup. The runner uses
persistent timestamps to decide whether the latest **03:00 UTC** deadline has
been satisfied. On first deployment it refreshes immediately. After downtime it
runs one catch-up refresh, rather than replaying every missed day. The daily
deadline is defined in [the runner](refresh/refresh-stage.sh); keep the
[cron poll](refresh/cron) every minute so catch-up and retries remain responsive.

Failed runs retry up to three times, waiting 10 then 20 seconds. Each attempt
has a 10-minute timeout (plus a 15-second kill grace); SQL statements and lock
waits are bounded too. After an exhausted batch, the scheduler checks again
15 minutes after that batch started. `REFRESH_MAX_ATTEMPTS`,
`REFRESH_RETRY_DELAY`, and `REFRESH_TIMEOUT_SECONDS` can override the defaults
in the cron container environment. Manual runs bypass the daily deadline and
cooldown. All runs share a file lock to prevent overlap.

[The attempt script](refresh/refresh-once.sh) restores into a scratch database
before touching current staging. It blocks new staging connections, disconnects
existing sessions, and runs [both database renames](refresh/swap-stage.sql) in
one transaction. If the swap fails, both names roll back. A cleanup handler
re-enables staging connections; after a hard crash, the next attempt also
repairs them. A server outage can still make staging unavailable until the
server returns and repair runs. The old database is retained as
`nest_stage_previous` until the next fully restored snapshot is ready.
`nest_test` and the source database are excluded from all replacements.

Success and failure status plus last-success/last-attempt Unix timestamps are
stored in the `stage_refresh_work` volume. Failures are logged with an ERROR
message. The Docker health check reports failures, abandoned runs, or a last
success older than 26 hours. It allows a running batch up to an hour. Docker
health is a monitoring signal, not an external notification; no email or chat
alerts are configured. Monitor it with:

```bash
docker compose ps stage-refresh
docker compose logs --tail=100 stage-refresh
docker compose exec -T stage-refresh sh -c 'cat /refresh/status /refresh/last-success /refresh/last-attempt'
```

A manual failure returns a nonzero exit status. Docker does not restart a
container just because it is unhealthy; the scheduler performs its own retries.
To rerun immediately after fixing an error, use `npm run db:refresh:stage`.

Run scheduler and swap regression tests with both database containers up:

```bash
npm run test:refresh
```

These use an isolated state volume, simulated refresh failures, and disposable
databases on the staging server. They verify catch-up, retry limits, cooldown,
overlap prevention, health reporting, and transactional swap rollback.

To stop scheduled refreshes, run `docker compose stop stage-refresh`.
`npm run db:up` enables them again.

Start the API in separate terminals to use both environments at once:

```bash
npm run start:production:local # http://localhost:3000
npm run start:stage            # http://localhost:3001
```

`npm run start:local` defaults to staging. Each command sets `DATABASE_URL`
for its process; the accounting, inventory, and profiles services all use that
connection. No service-specific database changes are needed.

Run API tests against the dedicated `nest_test` database on staging:

```bash
npm run test:e2e:local
```

The suite creates and removes an isolated schema for every test. It covers all
API routes, validation, accounting postings, persistence, concurrent stock
issues, and transaction rollback. Run unit tests with `npm test -- --runInBand`.

`npm run db:down` stops both containers and preserves their data volumes.
The original production service and volume names are retained so existing
local data stays available. An existing `nest_test` database on that original
volume is left untouched; the test command now uses staging instead.
The initialization SQL creates `nest_test` only when the staging volume is
first initialized.

Override `POSTGRES_PORT` for production or `STAGE_POSTGRES_PORT` for staging;
use the same override when starting Docker and the corresponding app/test:

```bash
STAGE_POSTGRES_PORT=5434 npm run db:up
STAGE_POSTGRES_PORT=5434 npm run start:stage
STAGE_POSTGRES_PORT=5434 npm run test:e2e:local
```

For an externally managed test database, use
`TEST_DATABASE_URL=postgresql://... npm run test:e2e -- --runInBand`.
