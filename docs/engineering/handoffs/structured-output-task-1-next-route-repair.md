# Structured Output Task 1 — Next Route Export Repair Handoff

Date: 2026-09-06

## Outcome

Moved `createStatusReader` unchanged from the App Router `route.ts` file to the
ordinary server module `src/server/jobs/public-job-status.ts`. The production
route and its integration test now import the reader from that module, leaving
`GET` as the route file's only export.

The move does not change selected fields, user ownership filters or checks,
successful-result parsing, retryability, failure categorization, or response
serialization. A direct diff of the old and new function bodies returned exit
0.

## Files

- Created `src/server/jobs/public-job-status.ts`.
- Modified `src/app/api/v1/jobs/[jobId]/route.ts`.
- Modified `tests/integration/jobs/public-job-route.test.ts`.
- Created this handoff.

No manifest, lockfile, dependency, config, migration, UI, extension, or domain
artifact changed. This server-only move uses no upstream-derived or GPLv3
material.

## RED evidence

The controller's generated route validator reproduced the target failure with
`pnpm typecheck` (exit 2):

```text
.next/types/app/api/v1/jobs/[jobId]/route.ts(14,13): error TS2344: Type 'OmitWithTag<typeof import(".../src/app/api/v1/jobs/[jobId]/route"), "GET" | "POST" | "HEAD" | "PATCH" | "DELETE" | "prefetch" | "config" | ... | "PUT", "">' does not satisfy the constraint '{ [x: string]: never; }'. Property 'createStatusReader' is incompatible with index signature.
```

The other diagnostics were the seven pre-existing
`practice-session.test.tsx` missing-`savedReturnTarget` TS2741 errors.

This fresh repair worktree initially had no dependencies or generated Next
types. After installing the unchanged lockfile and running `pnpm exec next
typegen`, Next 16 generated a consolidated structural `validator.ts` rather
than the controller's per-route validator, so local pre-fix `pnpm typecheck`
showed only the seven baseline errors. The controller should rerun its retained
per-route validator after applying this commit for the definitive TS2344
GREEN check.

## Verification

- `pnpm exec vitest run tests/integration/jobs/public-job-route.test.ts tests/integration/jobs/process-jobs.test.ts`
  - Exit 0; 2 files passed, 34 tests passed.
- `pnpm typecheck`
  - Nonzero as expected (the pnpm wrapper exited 1 after the underlying `tsc`
    reported exit 2); exactly the seven allowed baseline TS2741 diagnostics at
    `src/features/practice/practice-session.test.tsx` lines 63, 85, 105, 121,
    134, 150, and 162.
  - No diagnostic names the jobs route or `createStatusReader`.
- `rg -n '^export ' 'src/app/api/v1/jobs/[jobId]/route.ts'`
  - Only `GET` at line 56.
- Direct old/new `createStatusReader` body diff
  - Exit 0 with no output.
- `git diff --check`
  - Exit 0 with no output.

## Residual risk

- The controller's retained per-route `.next/types` environment is required to
  confirm that its original TS2344 is removed; fresh Next 16 `typegen` did not
  emit that validator shape in this worktree.
- The repository-wide typecheck remains nonzero only because of the seven
  explicitly allowed pre-existing practice fixture errors; they were not
  changed here.
