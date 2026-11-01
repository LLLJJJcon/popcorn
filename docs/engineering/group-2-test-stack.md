# Group 2 isolated local test stack

Setup completed 2026-11-01 06:30 UTC. This is test infrastructure preparation; independent product acceptance remains assigned to another agent. No product code, existing migration, personal environment file, personal data, commit or push was changed by this task. No real model request was made.

## Identity and boundaries

- Project ID: `popcorn-phase1-groups24`.
- Infrastructure workdir: `/private/tmp/popcorn-phase1-test-stack`.
- Code worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`.
- Config copied from that worktree, then isolated project/ports/auth redirects configured only inside `/private/tmp`.
- `supabase/migrations` and `supabase/tests` symlink to that code worktree. Repository `supabase/seed.sql` copied; no personal `.env` or database contents copied.
- Existing `node_modules` reused via symlink. Supabase CLI **2.114.0**, Node **24.13.1**, available pnpm **11.25.0** (package manifest pins 11.19.0). Run the installed CLI binary directly; pnpm exec attempted an automatic dependency check/install and was therefore not used for stack startup.

| Endpoint | Port | State |
| --- | --- | --- |
| API (Kong) | 54331 | Running; `http://127.0.0.1:54331` |
| PostgreSQL | 54332 | Running, healthy; major version 17 |
| Shadow DB | 54330 | Reserved in isolated config; unused during start |
| Studio | 54333 | Configured but disabled/excluded |
| Mail | 54334 | Configured but disabled/excluded |
| Analytics | 54337 | Configured but disabled/excluded |
| Pooler | 54339 | Configured but disabled/excluded |
| Edge inspector | 8084 | Configured but disabled/excluded |
| Future test app | 3103 | Reserved; not started by this setup |

Auth `site_url` is `http://127.0.0.1:3103`. Exact permitted redirects: `http://127.0.0.1:3103/auth/callback`, `/home`, `/sign-in` (each with the same complete origin, no wildcard). Current app uses direct credential sign-in and has no active auth callback route; the exact callback allowance is reserved for compatibility.

Only these containers were started: `supabase_db_popcorn-phase1-groups24`, `supabase_auth_popcorn-phase1-groups24`, `supabase_rest_popcorn-phase1-groups24`, `supabase_kong_popcorn-phase1-groups24`. Realtime, storage, imgproxy, mail, postgres-meta, Studio, Edge runtime, analytics/logflare/vector and pooler are excluded. No global proxy/network setting changed.

## Reproduce and operate safely

The CLI was invoked with an explicit infrastructure workdir:

```sh
/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度/node_modules/.bin/supabase start --workdir /private/tmp/popcorn-phase1-test-stack --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes
```

First start automatically initialized the new database, applied all current migrations through `202611010023_learning_card_confidence_compat.sql`, and loaded only the standard repository seed. No database reset was necessary. New worktree migrations added later are visible through the symlink but are **not** automatically applied to an already running database.

Every later CLI database operation must include `--workdir /private/tmp/popcorn-phase1-test-stack` and verify that config has project ID `popcorn-phase1-groups24`, API 54331 and DB 54332. Do not use the repository's bare `db:reset`/`db:test` commands: they resolve the code worktree's personal-project config. Environment variables alone do not redirect CLI project selection. For isolated SQL tests, use:

```sh
/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度/node_modules/.bin/supabase test db --workdir /private/tmp/popcorn-phase1-test-stack
```

A later reset, if required, must target this explicit `/private/tmp` workdir after checking project and ports. Never run default `supabase stop/reset` against the code worktree or the user's active project.

## Private credentials and safe loading

Status credentials are stored only in `/private/tmp/popcorn-phase1-test-stack.env` with mode **0600**. It contains the new stack's status variables (API/REST/GraphQL/DB URLs and generated keys); no personal configuration was mixed in. Values have not been printed in reports or tool outputs. The private startup log is `/private/tmp/popcorn-phase1-test-stack/start.log` (0600); do not print it unfiltered because successful CLI startup includes local credentials.

Run application/test commands through the temporary wrapper:

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py COMMAND ARGUMENTS...
```

It verifies the config identity, credential-file mode, and isolated API/DB ports; removes inherited Supabase credential aliases; loads only the test stack status; maps `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SUPABASE_DB_URL`; and sets `APP_URL=http://127.0.0.1:3103`. It does not print keys and does not set CI or choose a model provider. Caller must select fixture/CI behavior explicitly and must avoid real-model calls unless separately authorized. The wrapper supplies process environment only; it does not change the current directory or override Supabase CLI `--workdir` selection.

Safe loading checks passed: effective API port 54331, DB port 54332, APP_URL3103, service credential present (value not printed). Status should never be printed directly with `supabase status`, `env`, `printenv`, shell tracing, or whole-file reads in a report.

## Health and non-interference evidence

Before startup:

- All configured test ports (54330/31/32/33/34/37/39, 8084, 3103) had no TCP listener.
- No container, Docker volume, or network matched project `popcorn-phase1-groups24`.
- Personal app `http://127.0.0.1:3000/sign-in` returned HTTP 200; personal API `http://127.0.0.1:54321/auth/v1/health` returned HTTP 200.
- Original app listener PID 42640; original Docker listener PID 63683; personal project `popcorn-foundation-3` containers had four days uptime.

After startup, checked 2026-11-01T06:30:14Z:

- New `/auth/v1/health`: HTTP 200.
- New REST `/profiles?select=user_id&limit=3`, using the new service credential in memory: HTTP 200, two repository-seeded fixture profiles.
- New DB latest migration versions read directly: 202611010023, 202611010022, 202611010021.
- New DB, Auth and Kong containers healthy; PostgREST running and serving successful REST request.
- Personal app3000 and personal auth54321 remained HTTP 200.
- Original app still PID42640 on127.0.0.1:3000; Docker still PID63683 on54321/54322; personal containers still four days uptime. The separate new API/DB listeners are54331/54332.

Non-sensitive machine-readable evidence: `/private/tmp/popcorn-phase1-test-stack/setup-baseline.json` and `health.json`. This proves isolated infrastructure availability and no observed interruption of the original services; it is not a claim that Group2 product acceptance has passed.

## Portable E2E cleanup selection

The repository cleanup helper retains the standard local54322 default for ordinary54321-based checkouts. This task's two browser suites explicitly choose54332 from their validated54331 API origin, and reject a database URL that instead points to54322. The temporary launcher additionally verifies54331/54332 before starting Playwright. Only mock subprocess tests exercised standard54322 compatibility; actual integration remains exclusively on54332. No global workflow or production configuration was changed for this machine.
