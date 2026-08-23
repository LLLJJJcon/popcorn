# Delivery Task 3A — One-click local start and stop

## Identity

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: bounded Delivery Task 3A amendment approved by the user on 2026-08-23
- Baseline commit: `229ecac96fd7572a81ab930056af965e66eeec32`
- Worktree: `/private/tmp/popcorn-one-click`
- Branch: `codex/popcorn-one-click-start`

## Outcome

After one-time dependency, `.env.local`, account, gateway, and extension setup,
a personal user can start Popcorn with `pnpm popcorn:start` or by double-clicking
`Start Popcorn.command`. The launcher starts local Supabase, the Next.js Web app,
and `worker:local`, waits until the Web app is reachable, and opens the local
Popcorn URL. `pnpm popcorn:stop` or `Stop Popcorn.command` stops the launcher and
local Supabase without resetting or deleting local accounts or learning data.

This is a convenience layer over the accepted local-first architecture. It does
not add a hosted mode, desktop application framework, installer, daemon, account
sharing, telemetry, production process manager, or commercial operations scope.

## File ownership

The implementation Agent may create or modify only:

- `scripts/popcorn-local.mjs`
- `tests/integration/jobs/popcorn-local-runtime.test.ts`
- `tests/release/self-host-docs.test.ts`
- `Start Popcorn.command`
- `Stop Popcorn.command`
- `README.md`
- `docs/operations/local-self-host.md`
- `docs/engineering/handoffs/delivery/task-3a-one-click-start.md`

The implementation Agent must not modify:

- `package.json` or `pnpm-lock.yaml` (root scripts are controller-owned)
- `.env.example`, `.env.local`, or any credential-bearing file
- database migrations, generated database types, Supabase configuration, CI,
  extension runtime files, application routes, worker behavior, or the execution
  ledger
- Delivery Task 5 evidence files

The controller will add only the `popcorn:start` and `popcorn:stop` entries to
`package.json` after the implementation commit, then run the full task gate.

## Consumed interfaces

- `pnpm exec supabase start` and `pnpm exec supabase stop`
- existing `pnpm dev` and `pnpm worker:local`
- `.env.local` values already documented by the accepted self-host guide
- `APP_URL`, which must remain the exact HTTP(S) application URL consumed by the
  existing worker
- the package manager invocation supplied by pnpm; do not add a dependency

## Produced interfaces

- `node scripts/popcorn-local.mjs start`
- `node scripts/popcorn-local.mjs stop`
- controller-owned package aliases `pnpm popcorn:start` and
  `pnpm popcorn:stop`
- executable macOS wrappers `Start Popcorn.command` and
  `Stop Popcorn.command`
- a non-secret, repository-scoped runtime-state file under the operating
  system temporary directory, if persistent coordination is needed

## Required behavior

1. Start must fail before spawning services when `.env.local` is absent or any
   of the six required accepted local fields is empty. It reports field names
   only and never values.
2. Start must reject a duplicate live Popcorn launcher for the same repository.
3. Start runs Supabase startup to completion before starting Web and worker.
4. Start launches the existing Web and worker commands without copying their
   behavior, waits for `APP_URL` with a bounded timeout, then opens that URL in
   the platform browser. The external browser opener may be injected in tests.
5. SIGINT/SIGTERM and the stop command terminate both child processes, remove
   only launcher runtime state, and call ordinary `supabase stop`. They must
   never call `db reset`, remove volumes, or delete repository/user data.
6. A stale state file must not cause an unrelated process to be killed. Treat
   it as stale, remove it, and still perform ordinary Supabase stop.
7. Error output is bounded and credential-free. Do not print `.env.local`
   values, command environments, Provider data, transcripts, or Supabase keys.
8. The macOS wrappers resolve the repository from their own location so they
   work after a GitHub clone into a directory containing spaces.
9. Documentation clearly separates one-time setup from daily one-click use and
   retains the existing manual commands as troubleshooting/fallback paths.

## TDD protocol and expected RED evidence

Before creating production scripts or wrappers, add focused behavior tests and
run them. Expected RED evidence is an import/module-not-found failure for the
missing launcher, followed by behavior failures for start ordering, readiness,
duplicate/stale-state handling, and stop-without-reset semantics. A source-text
grep is not sufficient: tests must execute the launcher boundary with controlled
temporary state and injected slow/external operations.

For wrappers, an executable test may place a harmless fake `pnpm` on `PATH` and
assert its observed working directory and argument; do not add test-only switches
to production scripts.

After RED, implement the minimum behavior and rerun the focused tests for GREEN.
Record exact RED and GREEN commands and concise outputs in the handoff.

## Verification commands

Implementation Agent:

```bash
./node_modules/.bin/vitest run \
  tests/integration/jobs/popcorn-local-runtime.test.ts \
  tests/release/self-host-docs.test.ts
./node_modules/.bin/eslint \
  scripts/popcorn-local.mjs \
  tests/integration/jobs/popcorn-local-runtime.test.ts \
  tests/release/self-host-docs.test.ts
git diff --check 229ecac96fd7572a81ab930056af965e66eeec32..HEAD
```

Controller after adding the package aliases:

```bash
pnpm popcorn:start
pnpm popcorn:stop
./node_modules/.bin/vitest run \
  tests/integration/jobs/popcorn-local-runtime.test.ts \
  tests/integration/jobs/local-worker.test.ts \
  tests/release/self-host-docs.test.ts
pnpm typecheck
git diff --check 229ecac96fd7572a81ab930056af965e66eeec32..HEAD
```

The live start/stop smoke may use a controlled temporary environment or the
already-running local Supabase stack. It must not reset the database or expose
credentials. Do not repeat the full application test matrix for this bounded
launcher change unless focused verification uncovers a shared-code defect.

## Upstream reuse and license

- YouTube Digest upstream: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. This task does not touch transcript
  acquisition and must not copy or replace any upstream implementation.
- LLM Wiki upstream: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`. This task uses none of its methods
  and must not copy GPLv3 code, tests, prompts, components, or assets.
- New launcher code is original project code under Popcorn's MIT license. No new
  dependency or lockfile change is allowed.

## Handoff contract

Commit the scoped implementation and write
`docs/engineering/handoffs/delivery/task-3a-one-click-start.md`. Return only:

- status (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`)
- commit SHA
- one-line RED/GREEN verification summary
- risks or concerns
- handoff path

Do not spawn subagents. The controller will dispatch an independent reviewer.
