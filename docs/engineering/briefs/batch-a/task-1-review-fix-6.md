# Batch A Task 1 — Review Fix 6

## Identity and scope

- Full review baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Rejected HEAD: `f35417c618a68407be70bd0236310326584d8b4f`.
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent review: FAIL because a stale refresh storage write can finish after
  a newer login write; generation recheck rejects the promise but cannot undo
  the stale overwrite.

Allowed only: `extension/auth.js`, `extension/tests/auth.test.js`, this brief,
and `docs/engineering/handoffs/batch-a/task-1.md`. All other files forbidden.

## Required TDD correction

1. Add a deterministic deferred `chrome.storage.local.set` RED that places an
   old refresh inside session persistence, accepts a new login, then resolves
   storage operations in the adversarial order from the review. Assert the old
   refresh rejects and the final stored session is the new login.
2. Serialize every mutation of `popcorn_session` (refresh write, accepted-login
   write, confirmed-sign-out removal) through one worker-local mutation queue.
   Later mutations may not start their Chrome storage call until the prior one
   settles. Queue failures must not poison future mutations.
3. Retain generation invalidation. A refresh commit, while holding the mutation
   turn, must verify both its captured generation and that the currently stored
   session still exactly identifies the session it refreshed before writing;
   recheck generation after awaited storage. Any mismatch rejects and returns no
   token.
4. A newly accepted login invalidates older work before queuing its write; it is
   the final winner once its mutation resolves. Two overlapping login/sign-out
   transitions must not let an older generation remove or overwrite a newer
   session.
5. Confirmed sign-out invalidates, waits/catches its active refresh, then queues
   guarded final removal. `requiresDecision: true` performs no invalidation or
   session mutation. Keep all earlier race tests.
6. Do not persist generation or expose it/tokens. Preserve every approved PKCE,
   Origin, sender/storage/owner, route, upstream MIT, and GPL-isolation boundary.

Run Node RED/GREEN, focused Vitest/env, typecheck, production build, contract,
provenance, extension gate, and `git diff --check`. Update handoff, commit only
allowlisted files, return SHA/evidence/risks, and do not self-review.
