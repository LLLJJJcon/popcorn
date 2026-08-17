# Batch A Task 1 Independent Review Fix Brief

## Identity

- Plan/task: `2026-08-16-popcorn-batch-a-platform-capabilities.md`, Batch A Task 1.
- Original baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Reviewed failing head: `69ec3ba0acd4e358fc689a80632e03a0ec9d8ee5`.
- Worktree: `/private/tmp/popcorn-batch-a-1`; branch `codex/popcorn-batch-a-1`.
- Review verdict: FAIL (three Critical, two Important). This fix does not make the task accepted; a fresh independent re-review remains mandatory.

## Allowed files

Modify only the original Task 1 files plus the minimum worker/refresh correction surface:

- `extension/auth.js`
- `extension/background.js`
- `extension/options.js`
- `extension/options.html` only if script loading must change
- `extension/settings.js`
- `extension/manifest.json` only if worker script/config declarations must change
- `extension/tests/auth.test.js`
- create `extension/tests/auth-worker.test.js` if clearer than extending the existing test
- `src/app/auth/extension/page.tsx`
- `src/app/api/v1/extension/session/exchange/route.ts`
- create `src/app/api/v1/extension/session/refresh/route.ts`
- `tests/integration/extension/auth-exchange.test.ts`
- create `tests/integration/extension/auth-refresh.test.ts`
- this brief and `docs/engineering/handoffs/batch-a/task-1.md` (append a dated review-fix addendum)

Forbidden: shared contracts, `src/server/env.ts`, migrations/generated types, root config/lockfile, Side Panel/content script, Task 2+ files, ledger/checkpoints, dependencies, vendor notices. Preserve unrelated upstream `background.js` behavior; make only auth import/singleton/message-boundary edits.

## Required RED tests

Write and run failing tests before fixes. Preserve the failure output in the handoff. Tests must prove:

1. Authorization initiation uses exactly the extension-generated S256 challenge. Supabase Auth JS must not create/store a second verifier/challenge. The exact configured `EXTENSION_REDIRECT_ORIGIN + '/supabase'` is accepted; another syntactically valid extension ID is rejected before redirect.
2. The actual classic MV3 service worker loads auth support once, owns exactly one auth client/refresh mutex, initializes trusted storage restrictions, and exposes only bounded auth commands. Options calls `chrome.runtime.sendMessage`; it never imports/instantiates auth or reads `popcorn_session`/tokens.
3. The actual background sender boundary rejects YouTube content-script/tab senders and wrong-extension pages for auth commands. No message returns an access token, refresh token, PKCE verifier, or state. Concurrent internal worker token requests share one refresh.
4. Expired-session refresh goes through a Popcorn server route (preferred, so no Supabase anon key enters UI contexts) or an equivalently deployable configured Supabase request. If using the server route: it validates exact extension `Origin`, bounded refresh input and expected user; supplies configured Supabase `apikey`; rejects a returned different user; emits `no-store`; and never leaks Provider errors.
5. Exchange validates exact HTTP `Origin` as well as exact body redirect. Remove the per-handler in-memory replay `Set`; Supabase's single-use code response is authoritative. A second stateless request must call the Provider and return the bounded generic failure when Supabase rejects the reused code—do not promise process-local `409` durability.

## Required implementation

- Keep PKCE verifier/state/redirect/expiry in trusted `chrome.storage.session` before `launchWebAuthFlow`; clear on every terminal path. Tokens remain only in trusted `chrome.storage.local` under `popcorn_session` and never enter URL/DOM/content messages.
- Authorization page/handler must validate the exact configured extension redirect and create one Supabase `/auth/v1/authorize` request bound to the supplied external challenge (or another proven single-challenge mechanism). It may not use a PKCE client that silently generates a second verifier.
- `background.js` is the only runtime owner of `createAuthClient`. Since it is a classic worker today, use a compatible loading mechanism without converting or rewriting unrelated upstream behavior. The options page is a view/controller over bounded worker messages.
- Sender validation must use actual Chrome `sender.id`, `sender.url`/origin and `sender.tab` context, not a caller-supplied `message.source` flag.
- Keep the stable public manifest key and current MIT upstream attribution. No GPLv3 code/test/prompt/structure.

## Verification

Run and record:

```bash
node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js
pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts
CI=true pnpm typecheck
CI=true pnpm test:contract
CI=true pnpm test:provenance
pnpm test:extension
git diff --check
git status --short
```

If an optional created test file is not used, omit it from the command and state why. Commit the fix and return the new HEAD, RED/GREEN evidence, risk, and handoff path. Do not self-approve.
