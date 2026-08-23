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

Self-review then forced the slower stale contender to pause after reading the
old record until the faster contender published a live replacement. The
targeted command below was genuinely RED with both starters fulfilled, then
GREEN with one pass after quarantine compared the moved record to the expected
record and restored a changed live claim atomically before retrying:

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts \
  -t "stale recovery does not discard"
```

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

The focused Vitest gate passed 3 files and 34 tests. Full project TypeScript,
scoped ESLint, and the baseline diff check completed with exit 0. Self-review of
all changes since `dcfc32a` found only the authorized runtime, integration test,
and this handoff changed; controller-owned package aliases remain unchanged.

Outstanding risk is limited to external integration: no live Docker/Supabase
smoke was run. A process crash in the very small interval between stale-state
quarantine and unlink can leave an inert, non-secret `.stale` file in the OS
temporary directory; it is never treated as ownership state or used for PID
control.

## Independent review fix round 2/5

### Root cause and RED

Control requests were unauthenticated plain `ping` and `stop` strings. A stale
repository-A record pointing at a port reused by live repository B therefore
received B's owner response and stopped B. Cleanup also closed its control
server and removed state before ordinary Supabase stop, so a successor could
acquire while the old owner's teardown was still pending.

The real-loopback P1 regression command was run before production changes:

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts \
  -t "cannot authenticate|keeps the owner claim"
```

Vitest failed both selected tests (15 skipped). Repository A never ran its own
ordinary Supabase stop because its stale claim stopped B, and the teardown
contender fulfilled instead of rejecting. After the first ownership-ordering
fix, the teardown test was strengthened to start cleanup through the real
control protocol and wait until the remote stop command returned. The targeted
test was again genuinely RED: its contender fulfilled because the bounded
request timed out and the remote stopper discarded the still-live claim.

### Repair and GREEN

Control messages are now JSON records containing an action and the expected
non-secret `claimId`. A control handler returns owner responses only when that
identity matches its immutable published claim; missing or mismatched identity
cannot ping or stop the launcher. Stale A state is claim-qualified/quarantined,
then only A's injected stack receives ordinary Supabase stop.

Owner cleanup retains its authenticated control server and exact state record
while awaiting Supabase startup, terminating owned children, and completing
ordinary Supabase stop. An authenticated remote stop starts that shared cleanup
promise and immediately acknowledges `stopping`, preventing its bounded caller
from applying stale fallback. Only after Supabase stop completes does cleanup
atomically quarantine/remove the exact owned record and close its own server.
A teardown contender therefore rejects without spawning; after release a fresh
successor starts, and later old-owner stop calls cannot remove or stop it.

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts \
  -t "cannot authenticate|keeps the owner claim"
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

The selected P1 tests passed 2/2; the focused gate passed 3 files and 36
tests. Full TypeScript, scoped ESLint, and the baseline diff check completed
with exit 0.

No live Docker/Supabase smoke was run. Remote stop now acknowledges accepted
cleanup rather than waiting for completion; the owner keeps liveness until it
finishes, but a later external `supabase stop` command failure is not propagated
back to the already-returned remote CLI.

## Independent review fix round 3/5

### Root cause and RED

The authenticated stop handler started the shared cleanup promise but returned
`stopping` immediately, and the remote caller treated that acknowledgement as
success. The real `pnpm popcorn:stop` process could therefore exit 0 before
owner cleanup completed, while a later Supabase-stop rejection was swallowed
inside the owner process.

The original `204890b` runtime was restored before running the focused RED:

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts \
  -t "keeps the owner claim|real remote stop CLI|bounded remote stop timeout"
```

All three selected tests failed (16 skipped): the remote stop settled while
owner cleanup was still blocked, the real spawned CLI exited 0 after the
owner's Supabase-stop failure, and the bounded stop request resolved instead
of preserving the responsive owner's authority.

### Repair and GREEN

An authenticated owner now awaits its existing shared cleanup promise before
replying `stopped`, and replies `failed` if cleanup rejects. The remote command
returns success only for `stopped`; `failed` reaches the existing generic CLI
error boundary, so the injected credential sentinel is not printed.

Stop requests use a separate 30-second bound instead of the two-second ping
bound. After a stop timeout, the caller rereads the exact claim and performs a
short authenticated ping. A matching responsive owner causes a generic failure
without state quarantine or local Supabase fallback, leaving that owner
authoritative until its cleanup releases state. A later retry after safe state
release can take the ordinary Supabase-stop path. The control server also
avoids a late write to a client socket that already timed out.

```bash
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts \
  -t "keeps the owner claim|real remote stop CLI|bounded remote stop timeout"
./node_modules/.bin/vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
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

The selected tests passed 3/3 (16 skipped), the runtime suite passed 19/19,
and the focused gate passed 3 files and 38 tests. Full TypeScript, scoped
ESLint, and the baseline diff check completed with exit 0.

No live Docker/Supabase smoke was run. The remaining external-integration risk
is unchanged: real local service startup and teardown were not exercised in
this environment.

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
