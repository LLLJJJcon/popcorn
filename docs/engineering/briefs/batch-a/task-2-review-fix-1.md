# Batch A Task 2 — Independent Review Fix 1

## Identity

- Plan/task: Batch A platform capabilities, Task 2.
- Effective original task baseline: `21ee0e15ac3cd856b4ebfd1ffd62dd539b2fb53f`.
- Rejected implementation commit: `3740908dd6098851194b44532a184c4eb211e217`.
- Reviewed controller prerequisite now merged in this worktree through `3bfdd2c`:
  CONTRACT-006 migration 006 plus generated RPC types.
- Worktree: `/private/tmp/popcorn-batch-a-2`.

## Allowed files

- all application/test/handoff files originally allowed by Task 2
- `docs/engineering/briefs/batch-a/task-2-review-fix-1.md`

Explicitly forbidden: migrations/tests under `supabase/**`, generated database
types, extension files, shared contracts, root config, dependencies/lockfile,
ledger/checkpoints, and every file outside the original Task 2 allowlist plus
this brief/handoff.

## Required RED tests and corrections

### Consume CONTRACT-006 exclusively

1. HTTP 202 registration must call `register_resolve_snapshot_job`. A conflict
   returns the existing Popcorn job and never writes/overwrites
   `knowledge_jobs` or `knowledge_job_internal` through table operations. Never
   clear an existing result. Keep Provider IDs private.
2. A leased worker's first Provider 202 must call
   `transition_resolve_snapshot_failure` once with the exact owner, job, lease,
   attempt, frozen retry state, and bounded Provider ID. There must be no split
   `persistState` followed by `writePrivateInput` window.
3. Every retryable/pending/terminal outcome must use the same lease-fenced
   atomic failure RPC. Terminal outcomes clear input inside the RPC. Remove the
   handler's separate post-transition private cleanup path.
4. Ready completion may first write idempotent immutable snapshot/segments, but
   must publish only through `complete_resolve_snapshot_job`, which atomically
   sets succeeded, strict result, input clear, and saved-item ready. Remove all
   split application writes to those four states. A false/lost fence returns
   deferred and may leave only unreferenced idempotent snapshot evidence.
5. Every RPC supplies the DB-derived expected user and exact claimed lease /
   attempt. `claim_knowledge_jobs` remains the sole global discovery operation.
   No raw table scan or optional owner scope.

Add deterministic tests for each old failure window, conflict registration,
lost fence, exact RPC argument mapping, and absence of Provider/input/payload
from public status. Prefer behavioral fakes over source-text assertions.

### Stream-bound Provider responses

Replace `response.text()` with incremental `ReadableStream` consumption. Abort
or cancel immediately once cumulative encoded bytes exceed the configured
limit, including chunked responses with no trustworthy `Content-Length`; never
first allocate the whole body. Add RED fixtures that deliver multiple chunks,
cross the limit, prove later chunks are not consumed, and still parse a valid
bounded multi-chunk JSON response. Preserve timeout/error/language semantics.

## Verification

Run RED before implementation and record exact failures, then fresh GREEN:

- `CI=true pnpm vitest run tests/contract/transcript/supadata-provider.test.ts src/server/transcript/normalize-transcript.test.ts tests/integration/jobs/resolve-snapshot.test.ts`
- `CI=true pnpm typecheck`
- `CI=true pnpm build`
- `CI=true pnpm test:contract`
- `CI=true pnpm test:provenance`
- `CI=true pnpm verify`
- `CI=true pnpm db:test` (must remain 294/294)
- `git diff --check`

Commit only allowlisted Task 2 fix files/brief/handoff. Return SHA, RED/GREEN
totals, verification, remaining risks, and handoff path. Continue the pinned
YouTube Digest MIT method adaptation; copy no LLM Wiki GPLv3 code/tests/assets.
