# Delivery Task 3A — One-click local launcher handoff

## Status

Implementation commit: `0645452` (`feat: add one-click local Popcorn launcher`).

## TDD evidence

### RED

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts
```

The first run failed as intended because `scripts/popcorn-local.mjs` did not
exist, and the new documentation assertion could not find `pnpm
popcorn:start`. After introducing only the import surface, the same command
failed the behavior assertions: missing-field validation, Supabase/Web/worker
ordering and readiness, duplicate live-launcher rejection, stale-state ordinary
stop without killing an unrelated process, wrappers, and the daily-use docs.

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
```

The signal regression then failed as intended with `TypeError:
runLauncherCommand is not a function` before the signal-command boundary was
implemented.

### GREEN

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts
./node_modules/.bin/eslint scripts/popcorn-local.mjs tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts
git diff --check
```

Vitest passed 2 files and 15 tests. ESLint completed without warnings or
errors, and the working-tree diff check completed cleanly.

## Delivered files

- `scripts/popcorn-local.mjs` — validates non-empty required local fields,
  coordinates a single foreground launcher by repository-scoped temporary
  state and local control channel, starts Supabase before the existing Web and
  worker commands, waits for `APP_URL`, opens the browser, and uses ordinary
  `supabase stop` during cleanup.
- `Start Popcorn.command` and `Stop Popcorn.command` — executable macOS
  wrappers that resolve their own repository directory.
- `tests/integration/jobs/popcorn-local-runtime.test.ts` — controlled runtime
  behavior coverage for validation, ordering/readiness, duplicate/stale state,
  stop semantics, signals, and wrappers.
- `README.md`, `docs/operations/local-self-host.md`, and
  `tests/release/self-host-docs.test.ts` — one-time setup, daily launcher use,
  and manual fallback documentation.

## Risks and follow-up

- The controller must add the owned `popcorn:start` and `popcorn:stop` package
  aliases before the user-facing commands and wrappers can be smoke-tested.
- No live Supabase start/stop smoke was run here: focused tests inject the
  external operations, so this implementation does not reset a database,
  mutate a live service, or read `.env.local` values.
- The launcher reports only field names or generic service failures; it does
  not print environment values or command environments.

## Verification repair round 1

### Root cause and RED

```bash
./node_modules/.bin/tsc --noEmit
```

The command consistently failed with `TS2322` at the injected launcher seams
(including test lines 106, 112–114, 148, 151, 158, 180, and 200). JavaScript
inference had adopted the concrete default `ChildProcess`, `net.Server`, and
`Process` types, although the launcher needs only small `kill`/`once`,
`close`, and signal-listener ports. Event-expression callbacks also inferred
`Promise<number>` rather than the required `Promise<void>`.

### Repair and GREEN

`scripts/popcorn-local.mjs` now declares narrow structural JSDoc ports for
managed children, the control channel/server, signal listeners, and launcher
dependencies. The controlled fakes are therefore checked against the behavior
the launcher actually consumes, not full Node runtime implementations. Test
callbacks now explicitly return `Promise<void>`.

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts
./node_modules/.bin/eslint scripts/popcorn-local.mjs tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts
git diff --check 229ecac96fd7572a81ab930056af965e66eeec32..HEAD
```

TypeScript completed with exit 0; Vitest passed 2 files and 15 tests; ESLint
and the baseline diff check completed cleanly.

## Independent review repair round 1

The launcher now creates its repository state with an exclusive `wx` startup
claim carrying an owner id. Cleanup removes state only when that owner still
owns it, so a losing or cancelled starter cannot remove winner state or stop
winner resources. Early signals mark startup cancelled before any standalone
stop path, and startup checks cancellation around claim/control setup.

Control requests now have a bounded 2-second timeout; stale state falls through
to ordinary Supabase stop without PID-based process handling. Supabase command
output is run with ignored stdio, while Web and worker service output remains
inherited. The focused runtime/docs Vitest gate passed 16 tests, followed by
clean TypeScript and ESLint runs.

Follow-up coverage adds a two-launcher exclusive-claim race and a signal-before-
startup-boundary case. The focused runtime/docs suite now passes 18 tests.

## Independent review repair round 2

### Root cause and RED

The exclusive repair claim was published as `{ starting: true }` before a
control port existed. That state had no liveness probe, yet every later starter
treated it as a live owner forever. A launcher that lost this claim could also
run its standalone `stop()` path and remove or stop the winner's resources.
Injected control/readiness timeouts were not available, and signal cleanup did
not remain awaitable through the final ordinary Supabase stop.

With the five requested real-boundary behaviors added before production edits,
the loopback-enabled RED command was:

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
```

Vitest failed 6 of 14 tests for the expected reasons: loser cleanup stopped the
winner; a crashed `{ starting: true }` claim remained unrecoverable; concurrent
ownership did not preserve winner state after loser `stop()`; the pending-start
signal path returned before `supabase stop`; a non-responsive real TCP server
used the fixed 2-second timeout instead of the injected 50 ms timeout; and real
default readiness exceeded the injected 75 ms deadline. The real default CLI
credential-suppression test already passed against the partial repair.

### Repair and GREEN

Each starter now creates its own loopback control server before publishing one
immutable `{ repositoryRoot, claimId, port }` claim with `wx`. A loser pings the
published owner with a bounded request, closes only its own server, and records
the loss so its later `stop()` is a no-op. Unreachable or pre-control state is
atomically quarantined with `rename` before acquisition retries, preventing two
stale-state contenders from both deleting a newly acquired claim. Cleanup is a
shared promise, so a signal received during Supabase startup waits for startup
completion and then performs ordinary Supabase stop without spawning Web,
worker, or the browser.

The default control/readiness implementations accept narrow injected timeouts.
Real loopback coverage proves a non-responsive unrelated server remains
listening after bounded stale cleanup, and real CLI coverage proves ignored
Supabase stdio cannot print a credential sentinel while a separate harmless log
records exactly `exec supabase stop`.

```bash
./node_modules/.bin/vitest run \
  tests/integration/jobs/popcorn-local-runtime.test.ts \
  tests/integration/jobs/local-worker.test.ts \
  tests/release/self-host-docs.test.ts
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint \
  scripts/popcorn-local.mjs \
  tests/integration/jobs/popcorn-local-runtime.test.ts \
  tests/release/self-host-docs.test.ts
git diff --check 229ecac96fd7572a81ab930056af965e66eeec32
```

The focused Vitest gate passed 3 files and 33 tests. Full project TypeScript,
scoped ESLint, and the baseline diff check completed with exit 0. Self-review of
all changes since `dcfc32a` found only the authorized runtime, integration test,
and this handoff changed; controller-owned package aliases remain unchanged.

Outstanding risk is limited to external integration: no live Docker/Supabase
smoke was run. A process crash in the very small interval between stale-state
quarantine and unlink can leave an inert, non-secret `.stale` file in the OS
temporary directory; it is never treated as ownership state or used for PID
control.

## Controller-owned root aliases

The controller added only the approved root package interfaces:

```text
popcorn:start → node scripts/popcorn-local.mjs start
popcorn:stop  → node scripts/popcorn-local.mjs stop
```

The package-contract test first failed because both aliases were absent. After
the two `package.json` entries were added, the controller gate passed 26/26
focused tests together with ESLint, full project TypeScript, and diff checks.
No dependency or lockfile changed.
