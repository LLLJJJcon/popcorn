# Batch A Task 1 — Review Fix 3

## Identity

- Plan/task: Batch A platform capabilities, Task 1.
- Original review baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Rejected implementation HEAD: `4492a85fd55162c4fc33057da2284ff3bbbf8461`.
- Reviewed controller contract prerequisite now merged: `e9100b1` (source
  CONTRACT-005 `4593838`).
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent re-review result: FAIL on real Chrome Identity callback shape and
  fragment token acceptance.

## Allowed files

- `extension/auth.js`
- `extension/tests/auth.test.js`
- `src/app/auth/extension/page.tsx`
- `src/server/auth/extension-session.ts`
- `tests/integration/extension/auth-exchange.test.ts`
- `tests/integration/extension/auth-refresh.test.ts`
- `docs/engineering/handoffs/batch-a/task-1.md`
- this brief

Forbidden: shared env implementation/tests (CONTRACT-005 is frozen), other
extension files, migrations/generated types, root config, dependencies,
lockfile, ledger/checkpoints, and all other files.

## Required corrections

1. `chrome.identity.getRedirectURL("supabase")` must be represented exactly as
   `https://<runtime-extension-id>.chromiumapp.org/supabase`. Do not use a
   `chrome-extension://` callback. Validate that the callback host proves the
   same stable `chrome.runtime.id`; reject paths/origins not exact.
2. The server's callback value remains
   `${EXTENSION_REDIRECT_ORIGIN}/supabase`, where the frozen environment origin
   is Chromium HTTPS. Exchange and refresh request `Origin` validation must use
   CONTRACT-005's derived/asserted `chrome-extension://<same-id>` request
   origin, never compare the request Origin to the callback origin.
3. Preserve the reviewed GoTrue-compatible flow: lowercase `s256`, no caller
   top-level GoTrue state, one extension state in nested `redirect_to` as exact
   `popcorn_state`, exactly one callback code/state, one-time code exchange,
   no tokens in URLs.
4. Reject every non-empty callback fragment before exchange. Add RED coverage
   for `#access_token`, `#refresh_token`, another token-shaped field, and an
   arbitrary non-empty fragment; no exchange request may occur.
5. Keep the prior approved worker/session/sender/refresh/owner/sign-out/storage
   boundaries unchanged. Route modules must still export only `POST`; test
   factories stay in `src/server/auth/extension-session.ts`.

## TDD and verification

- First update tests to the real Chromium callback and fragment rejection; run
  focused auth tests against the rejected implementation and record RED.
- Implement the minimum changes, then run:
  - `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js`
  - `pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts`
  - `CI=true pnpm typecheck`
  - `CI=true pnpm build`
  - `CI=true pnpm test:contract`
  - `CI=true pnpm test:provenance`
  - `CI=true pnpm test:extension`
  - `git diff --check`
- Commit only the review-fix files and append RED/GREEN evidence to the existing
  handoff. Return SHA, test totals, risks, and handoff path.

## Upstream and license

Continue adapting YouTube Digest's MIT manifest/options/storage shapes in place.
This fix is Chrome Identity/PKCE glue; copy no LLM Wiki GPLv3 code, tests,
prompts, components, or assets.
