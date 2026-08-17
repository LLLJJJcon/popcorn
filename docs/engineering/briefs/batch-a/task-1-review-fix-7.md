# Batch A Task 1 — Review Fix 7

## Identity and scope

- Full review baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Rejected HEAD: `2dc7200d66b7864ef89c83319d037e67ab62987c`.
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent review reproduced a stale-token return between the mutation
  callback's post-write check and the awaiting `refreshSession` continuation.

Allowed only: `extension/auth.js`, `extension/tests/auth.test.js`, this brief,
and `docs/engineering/handoffs/batch-a/task-1.md`. All other files forbidden.

## Exact TDD correction

1. Add a deterministic RED matching the reviewer sequence: refresh storage set
   completes and its queue callback post-check passes; a confirmed sign-out is
   already waiting on a deferred pending-events read; release that read so
   sign-out advances generation before `refreshSession` returns. Assert refresh
   rejects, never resolves a token, and sign-out leaves session absent.
2. After `await queueSessionMutation(...)` returns in `refreshSession`, perform
   one final synchronous `assertCurrentGeneration(refreshGeneration)` immediately
   before returning the token. No await or callback boundary may exist between
   this check and return.
3. Preserve the queue, source-session comparison, pre/in/post-write checks,
   generation behavior, all 18 previous race tests, and every earlier approved
   PKCE/Origin/worker/owner/license boundary.

Run Node RED/GREEN, focused Vitest/env, lint, typecheck, production build,
contract, provenance, extension gate, and `git diff --check`. Update handoff,
commit only allowlisted files, return SHA/evidence/risks, and do not self-review.
