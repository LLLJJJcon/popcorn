# Atomic transcript-job contract — Review Fix 1

## Identity and scope

- Original gate baseline: `e9f3d292da3dd7ff352d8ba4ea232831ded9cc85`.
- Rejected gate HEAD: `a8ee195f47d4e27c3adb29c93d299ad60cd20873`.
- Worktree: `/private/tmp/popcorn-resolve-job-atomic-contract`.
- Independent review: FAIL on empty-internal attach recovery and incomplete
  attempt/backoff regression coverage.

Allowed only:

- `supabase/migrations/202608160006_resolve_job_atomicity.sql`
- `supabase/tests/rls.sql`
- `docs/engineering/handoffs/batch-a/contract-resolve-job-atomicity.md`
- this brief

All original forbidden files remain forbidden, especially generated types,
application code, earlier migrations, root config, lockfile, and ledger.

## Required TDD fix

1. Add a failing pgTAP case for a leased job whose existing
   `knowledge_job_internal` row is exactly `input={}`, `result=null`. A retry
   transition with a bounded Provider ID must return true and atomically replace
   that empty input with exactly `{ "providerJobId": ... }`.
2. Preserve (never overwrite or clear) any existing non-empty input or non-null
   result. The conditional conflict path must be owner-safe and may update only
   the exact empty/no-result recovery state. Do not weaken the public lease and
   attempt CAS.
3. Freeze attempts 1 through 4 for immediate non-retryable
   `terminal_failed` transitions with atomic input clearing.
4. Freeze attempts 1/2/3/4 retry backoff to 1/2/4/8 minutes and reject a wrong
   next-attempt clock without mutation. Retain attempt 5 terminal semantics.
5. First run `pnpm db:test` after test changes and record the meaningful RED;
   then change migration and run a clean `pnpm db:reset` followed by GREEN.

Run fresh `pnpm db:test`, `CI=true pnpm test:contract`, `CI=true pnpm
typecheck`, `CI=true pnpm build`, and `git diff --check`. Append the handoff,
commit only allowlisted files, and return SHA/evidence/risks. No upstream or
GPLv3 code applies.
