# Delivery Task 5 live-start repair handoff

## Scope

Baseline: `6ccb465` (`docs: brief live startup repair`).

Changed only the permitted route, launcher, their integration tests, and this
handoff. No credentials, Provider calls, deployment work, generated files, or
configuration workarounds were used.

## Cycle 1 — processor environment selection

### RED

Command:

```bash
pnpm vitest run tests/integration/jobs/process-jobs.test.ts
```

Result: 25 passed and 1 failed. The new real-`POST` boundary test failed at
`ProcessorEnvSchema.parse(process.env)` with Zod `unrecognized_keys`, including
ordinary runtime variables and `POPCORN_ORDINARY_RUNTIME_VARIABLE`; it never
reached the expected unauthenticated 401 response.

### GREEN

Minimal change: the route now passes a literal object containing only
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPADATA_API_KEY`,
and `INTERNAL_JOB_SECRET` into the existing strict processor schema.

Command:

```bash
pnpm vitest run tests/integration/jobs/process-jobs.test.ts
```

Result: 1 file passed, 26 tests passed. The test calls the real exported
`POST`, supplies inert processor values plus an unrelated variable, receives
401 without a bearer token, and restores `process.env` exactly afterward.
The route module still exports `POST` only.

## Cycle 2 — configured Web host and port

### RED

Command:

```bash
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
```

Result: the launcher ordering assertion showed the observed Web event as
`service dev`, while the strengthened expected event was
`service dev --hostname 127.0.0.1 --port 3010`. The initial sandboxed complete
run also could not bind test-only loopback control ports (`listen EPERM`), so
the same test was rerun with approved loopback access. That run isolated one
additional fixture correction: the readiness-failure test uses a dynamic
temporary port, so its expected Web event now uses that fixture port.

### GREEN

Minimal change: after validated `.env.local` is read, the launcher parses
`APP_URL` once and spawns the Web service as `pnpm dev --hostname <hostname>`;
it appends `--port <port>` when the validated URL specifies one. The worker
invocation remains `pnpm worker:local`; readiness and browser URLs are
unchanged.

Commands:

```bash
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts -t 'starts Supabase before the Web app and worker, waits for the app, then opens APP_URL'
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
```

Results: ordering test passed (1 passed, 19 skipped); complete launcher suite
passed (1 file passed, 20 tests passed) when run with the approved test-only
loopback permission.

## Review fix — explicit default APP_URL port

Independent review found that `URL.port` normalizes explicit default ports to
an empty string (`http://127.0.0.1:80`), which would omit `--port` and make
Next select its own default port.

### RED

Command:

```bash
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts -t 'passes an explicit default APP_URL port to the Web service'
```

Result: 1 failed and 20 skipped. The new observable launcher fixture supplied
`APP_URL=http://127.0.0.1:80`; its expected event was
`service dev --hostname 127.0.0.1 --port 80`, but the observed event omitted
the port.

### GREEN

Minimal change: retain `URL.hostname` and its non-default `port`, while also
extracting an explicitly supplied authority port from the already validated
raw `APP_URL` when URL normalization elides a default. No validation rules,
browser URL, worker arguments, or Next configuration changed.

Commands:

```bash
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts -t 'passes an explicit default APP_URL port to the Web service'
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
```

Results: regression fixture passed (1 passed, 20 skipped); complete launcher
suite passed (21/21) with approved test-only loopback permission.

## Focused verification

```bash
pnpm vitest run tests/integration/jobs/process-jobs.test.ts
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
pnpm exec eslint src/app/api/internal/jobs/process/route.ts tests/integration/jobs/process-jobs.test.ts scripts/popcorn-local.mjs tests/integration/jobs/popcorn-local-runtime.test.ts
pnpm typecheck
git diff --check
git status --short
```

Results: processor suite passed (26/26), launcher suite passed (21/21), ESLint
completed with exit 0, `tsc --noEmit` completed with exit 0, and `git diff
--check` completed with exit 0. The pre-commit status listed only the five
allowed files named below.

## Changed files

- `src/app/api/internal/jobs/process/route.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `scripts/popcorn-local.mjs`
- `tests/integration/jobs/popcorn-local-runtime.test.ts`
- `docs/engineering/handoffs/delivery/task-5-live-start-fix.md`

## Self-review

- The processor schema remains strict; its input projection does not add
  retired or global Provider fields, and missing or invalid declared values
  still fail parsing.
- The route's public export surface remains exactly `POST`.
- Web host and port come from validated `APP_URL`, are not hard-coded, and do
  not alter manual `pnpm dev`, `next.config.ts`, the browser URL, worker
  arguments, sequencing, state ownership, or cleanup. Explicit default ports
  are retained despite URL normalization.
- All test changes assert observable behavior. The environment-boundary test
  uses inert values and restores the original process environment.

## Residual risks

- This worktree deliberately did not run a real launcher, database, browser,
  or Provider smoke. The Controller must perform the separately authorized
  credential-holding local smoke from its designated worktree.
- Full launcher tests require a loopback listener; in restricted sandboxes they
  need the approved test-only permission used above.
