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
