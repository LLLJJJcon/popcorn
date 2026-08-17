# Batch A Task 1 — Review Fix 5

## Identity and scope

- Full review baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Rejected HEAD: `ad67dc378d9ce8c5008d26e5475216e8ab65d291`.
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent review: FAIL because an invalidated refresh still returns the old
  account access token to its waiting caller.

Allowed only: `extension/auth.js`, `extension/tests/auth.test.js`, this brief,
and `docs/engineering/handoffs/batch-a/task-1.md`. All other files forbidden.

## TDD correction

1. Change the two deterministic races added in Fix 4 so the old refresh promise
   rejects after confirmed sign-out and after a newly accepted login. It must
   never resolve with the stale access token. Keep final storage assertions.
2. Add/retain a meaningful RED against `ad67dc3`.
3. In `refreshSession`, check the captured generation before starting session
   persistence and again after awaited persistence. Any mismatch throws a
   bounded auth/session-invalidated error and never returns the refreshed token.
   Do not create another refresh or token path.
4. Confirmed sign-out still invalidates first, waits/catches the active refresh,
   then removes the session as final mutation. A new accepted login still wins
   storage. `requiresDecision: true` must not invalidate and its refresh must
   continue to resolve normally.
5. Preserve every earlier approved PKCE, Chromium Origin, worker/sender/storage,
   owner/sign-out, route, upstream, and license boundary.

Run Node RED/GREEN, focused Vitest/env, typecheck, production build, contract,
provenance, extension gate, and `git diff --check` exactly as Fix 4. Update the
handoff, commit only allowlisted files, and return SHA/evidence/risks.
