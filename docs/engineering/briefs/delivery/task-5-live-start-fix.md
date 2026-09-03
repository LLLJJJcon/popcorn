# Delivery Task 5 live-start repair brief

## Identity

- Trigger: first real `pnpm popcorn:start` attempt during revised Delivery Task 5
- Baseline commit: `e8aa3c4`
- Worktree: `/private/tmp/popcorn-live-start-fix`
- Branch: `codex/popcorn-live-start-fix`
- Parent task: revised Delivery Task 5 real local smoke

## Reproduced failures and root causes

1. The Web process became ready, but every local-worker request returned 500.
   `ProcessorEnvSchema` inherits strict-object behavior and the route passed the
   whole `process.env`, so ordinary OS/Node/Next variables were rejected before
   authentication or job processing. Existing `getServerEnv` code establishes
   the working pattern: select declared keys first, then strict-parse them.
2. Next.js warned that requests from the configured
   `APP_URL=http://127.0.0.1:3000` were cross-origin because the launcher ran
   plain `pnpm dev`, whose displayed default host was `localhost`. Launcher
   tests stubbed Web readiness and therefore did not prove that the spawned Web
   command used the configured host and port.

## Allowed files

- Modify `src/app/api/internal/jobs/process/route.ts`
- Modify `tests/integration/jobs/process-jobs.test.ts`
- Modify `scripts/popcorn-local.mjs`
- Modify `tests/integration/jobs/popcorn-local-runtime.test.ts`
- Create `docs/engineering/handoffs/delivery/task-5-live-start-fix.md`

All other files are forbidden. In particular, do not modify `src/server/env.ts`,
`next.config.ts`, `.env*`, migrations, generated types, root configuration,
package/lockfile, Task 5 evidence, Provider code, prompts, or extension code.

## TDD protocol

Perform two separate RED/GREEN cycles in order.

### Cycle 1 — processor environment selection

- Add one focused runtime-boundary test to
  `tests/integration/jobs/process-jobs.test.ts`.
- Temporarily provide the four required processor values plus ordinary unrelated
  process variables, call the real exported `POST` with no valid bearer, and
  expect a normal 401 response rather than a schema exception. Restore the
  process environment exactly after the test.
- The test must exercise the real route composition. It may use inert local or
  example values because missing authentication must stop before any database or
  Provider request.
- Record RED showing the current strict unrecognized-key failure.
- Minimal GREEN: keep the strict four-field schema, but pass it an object
  containing only its four declared values. Do not relax the schema and do not
  accept retired/global Provider fields.

### Cycle 2 — configured Web host and port

- Strengthen the existing launcher ordering test so its observable spawn event
  requires the Web service to receive the hostname and explicit port parsed from
  `APP_URL` (`127.0.0.1` and `3010` in the existing fixture). Keep worker args
  unchanged.
- Record RED showing the current `service dev` event.
- Minimal GREEN: after validated `.env.local` is read, parse `APP_URL` once and
  spawn the Web service with `pnpm dev --hostname <hostname>` plus
  `--port <explicit-port>` when the URL contains a port. Do not add a Next root
  config workaround, hardcode port 3000, alter the browser URL, or change manual
  `pnpm dev` behavior.

## Interfaces and constraints

- Preserve the route module's exact public export surface: `POST` only.
- Preserve strict missing/invalid processor-field failure and existing retired
  environment rejection.
- Preserve launcher sequencing, state ownership, cleanup, worker arguments,
  bounded waits, and one-click commands.
- No real credentials may enter tests, reports, commits, logs, or prompts.
- This is a personal local fix; no deployment, load, concurrency, firewall, or
  commercial work is permitted.

## Verification

```bash
pnpm vitest run tests/integration/jobs/process-jobs.test.ts
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts
pnpm exec eslint src/app/api/internal/jobs/process/route.ts tests/integration/jobs/process-jobs.test.ts scripts/popcorn-local.mjs tests/integration/jobs/popcorn-local-runtime.test.ts
pnpm typecheck
git diff --check
git status --short
```

Do not run database reset, pgTAP, full application, browser, Provider, load, or
concurrency suites in the repair worktree. After independent review, the
Controller will rerun the real launcher from the credential-holding Task 5
worktree.

## Upstream and license

- No YouTube Digest code is changed or recopied; preserve MIT attribution and
  pinned commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- No LLM Wiki code, tests, prompts, prose, components, or assets may be copied;
  GPLv3 remains method-only at `723e259309aea5e3850265b631f80224f66dd9f6`.
- No license or dependency change.

## Handoff

Commit allowed-file changes. Write both RED/GREEN cycles, exact commands and
results, changed files, self-review, and residual risks to
`docs/engineering/handoffs/delivery/task-5-live-start-fix.md`. Return status,
commit SHA, focused results, concerns, and report path only.
