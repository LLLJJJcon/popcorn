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
