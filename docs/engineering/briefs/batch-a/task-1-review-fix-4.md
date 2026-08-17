# Batch A Task 1 — Review Fix 4

## Identity and scope

- Full review baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Rejected Task 1 HEAD: `20147541c68d04db29ac5c66031c461f1863a600`.
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent review: FAIL on refresh/sign-out race and PKCE cleanup before
  `launchWebAuthFlow`.

Allowed only:

- `extension/auth.js`
- `extension/tests/auth.test.js`
- `docs/engineering/handoffs/batch-a/task-1.md`
- this brief

All other files are forbidden. Preserve CONTRACT-005 and every previously
approved server/page/worker/manifest boundary unchanged.

## Required TDD corrections

1. Add a deterministic deferred-refresh test proving an in-flight refresh
   cannot restore `popcorn_session` after a successful sign-out. Resolve the
   Provider refresh only after sign-out has begun and assert the final session
   is absent.
2. Add a deterministic old-refresh/new-login race test: a refresh that started
   from the old session must never overwrite a subsequently accepted new
   interactive session.
3. Implement a service-worker-local monotonically changing session generation
   (or an equally strong serialized mutation scheme). Refresh captures the
   generation and may persist only while still current. A confirmed sign-out
   invalidates the generation before waiting for the active refresh to settle,
   then removes the session so removal is the final mutation. A newly accepted
   interactive session invalidates older refreshes before storing its tokens.
   Do not expose generation/tokens to other contexts and do not add a second
   refresh path.
4. Do not invalidate a session merely because sign-out reports
   `requiresDecision: true`; invalidation begins only when sign-out will
   actually proceed.
5. Put every operation after PKCE persistence—including S256 digest, sign-in
   URL construction, and `launchWebAuthFlow`—inside cleanup coverage. Add RED
   tests for digest rejection and invalid app URL/URL construction; both must
   leave `chrome.storage.session` empty and never exchange.
6. Keep the real Chromium callback, nested GoTrue state, fragment rejection,
   sender/storage/owner isolation, route-only exports, and prior behavior.

Run RED first, then GREEN:

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js`
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts`
- `CI=true pnpm typecheck`
- `CI=true pnpm build`
- `CI=true pnpm test:contract`
- `CI=true pnpm test:provenance`
- `CI=true pnpm test:extension`
- `git diff --check`

Append handoff evidence, commit only allowlisted files, and return SHA, totals,
risks, and handoff path. This is original auth concurrency work; copy no GPLv3
code/tests and keep YouTube Digest MIT adaptation boundaries.
