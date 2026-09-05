# Structured Output Task 1 — Next Route Export Repair Brief

- Plan: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 1.
- Integrated implementation baseline: `b9956a9560a67054a12707c3cad1977b9b773130`.
- Repair branch: `codex/structured-output-task-1-next-route-repair`.
- Worktree: `/private/tmp/popcorn-structured-output-task-1-next-route-repair`.

## Root cause and required fix

Controller verification generated `.next/types` and reproduced TS2344: App
Router `route.ts` may export supported HTTP handlers/config only, while Task 1
exported `createStatusReader` solely for a production-boundary test. Move that
unchanged reader into a normal server module and import it from both the route
and test. Keep `route.ts` exports limited to `GET`.

## Allowed files

- Create: `src/server/jobs/public-job-status.ts`
- Modify: `src/app/api/v1/jobs/[jobId]/route.ts`
- Modify: `tests/integration/jobs/public-job-route.test.ts`
- Create: `docs/engineering/handoffs/structured-output-task-1-next-route-repair.md`

No other file may change. Do not alter query fields, owner checks, response
serialization, error categories, domain artifacts, dependencies, config,
lockfile, migration, UI, or extension.

## TDD and focused verification

RED is the existing `pnpm typecheck` TS2344 naming `createStatusReader` in the
route export. After the minimal move, run:

```bash
pnpm exec vitest run tests/integration/jobs/public-job-route.test.ts tests/integration/jobs/process-jobs.test.ts
pnpm typecheck
git diff --check
```

GREEN typecheck means the route-export TS2344 is gone; only the seven existing
`practice-session.test.tsx` missing-`savedReturnTarget` errors may remain. Do not
fix those unrelated errors. Do not run the full suite/build/Playwright/database
or Provider smoke.

## License and handoff

This server-only move touches no upstream-derived or GPLv3 material. Commit the
four allowed files and report the commit SHA, RED/GREEN evidence, exact files,
and risks. Do not merge, rebase, or push.
