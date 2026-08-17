# Task Handoff
- Status: DONE
- Plan and task: `2026-08-16-popcorn-batch-a-platform-capabilities.md`, Batch A Task 1
- Worktree and branch: `/private/tmp/popcorn-batch-a-1`, `codex/popcorn-batch-a-1`
- Baseline SHA: `b258e49fb745eac0309de3fcb6848e87ef43979f`
- Commit SHA: recorded by the commit that includes this handoff

## Implemented
Adapted the vendored options surface from provider keys to explicit Popcorn account linking. Added trusted-context PKCE/session handling, a single refresh mutex, owner-bound sign-out protection, the browser PKCE launch page, and bounded server-side PKCE exchange.

## Upstream provenance used
YouTube Digest `manifest.json` → `extension/manifest.json`: retained MV3/Side Panel/options/content structure; added public stable key, `identity`, `alarms`, and Popcorn-only hosts. `options.html`/`options.css` → same paths: retained the settings-shell/card/accessibility structure while replacing key entry with account and cache controls. `options.js:createStorageAdapter`, `initialize`, cached-data controls → same path: retained Chrome-storage adapter/cache pattern while binding UI to account linking. `settings.js:STORAGE_KEY`, `normalize`, `migrateLegacyCustom` → same path: removed credential/model values while preserving migration helpers. Source is `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT; no license or notice changed, and new `extension/tests/auth.test.js` is Popcorn-specific coverage. No LLM Wiki material applies.

## Interfaces consumed and produced
Consumes Chrome 116 Identity/Storage APIs, Supabase PKCE, and exact `EXTENSION_REDIRECT_ORIGIN`. Produces `beginInteractiveSignIn`, `getSession`, `getAccessToken`, `signOut`, and one refresh mutex in `extension/auth.js`; the exchange route returns only a bounded no-store session envelope.

## Files changed
`extension/manifest.json`, `extension/options.html`, `extension/options.css`, `extension/options.js`, `extension/settings.js`, `extension/auth.js`, `extension/tests/auth.test.js`, `src/app/auth/extension/page.tsx`, `src/app/api/v1/extension/session/exchange/route.ts`, `tests/integration/extension/auth-exchange.test.ts`, this handoff, and the unchanged controller brief.

## TDD evidence
### RED
`node --test extension/tests/auth.test.js` exited 1 because `extension/auth.js` was absent. `pnpm vitest run tests/integration/extension/auth-exchange.test.ts` exited 1 because the exchange route was absent. A later focused auth RED asserted the refresh destination and failed because it used an undeclared app refresh endpoint instead of the Supabase auth token URL.

### GREEN
`node --test extension/tests/auth.test.js` exits 0 (5/5): click-only exact `getRedirectURL("supabase")` PKCE, terminal cleanup, trusted session/token storage, content-message rejection, shared refresh success/error mutex, and owner-bound pending-event sign-out. `pnpm vitest run tests/integration/extension/auth-exchange.test.ts` exits 0 (2/2): exact redirect validation, bounded/replay-safe exchange, one Supabase token request, no-store, and no provider-error leakage.

## Broader verification
All exit 0: `CI=true pnpm typecheck`; `CI=true pnpm test:contract` (128/128); `CI=true pnpm test:provenance` (11/11); `pnpm test:extension` (4/4); `git diff --check`. The manifest key is a public SPKI value only and derives unpacked ID `meocnghfgmmcnnjiihpcgjnaameioddp`, hence redirect origin `chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp`.

## Contract or migration changes requested
None.

## Risks and follow-up
Before deployment, register the documented stable redirect URI with Supabase and deploy the matching `EXTENSION_REDIRECT_ORIGIN`; fixture Popcorn/Supabase hosts are intentionally the only non-YouTube manifest hosts. Pending-event upload/sync-first execution remains Batch A Task 6; this task deliberately requires an explicit discard decision and never transfers old-owner events. No self-approval was performed.

## 2026-08-17 review-fix addendum
- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Reviewed head fixed: `69ec3ba0acd4e358fc689a80632e03a0ec9d8ee5`.

### Corrections
- The classic MV3 worker imports `auth.js` once, owns the singleton client/mutex, applies Chrome sender (`id`, exact options URL, no tab) checks, and exposes only bounded account, sign-in/out, and cache-count responses. Options no longer loads or creates auth and does not enumerate local storage.
- The authorization page validates the exact configured redirect and manually redirects to Supabase `/auth/v1/authorize` with the extension-generated S256 challenge. It no longer creates a Supabase browser client, preventing a second verifier/challenge.
- Token refresh is now a bounded, no-store Popcorn server route with exact extension `Origin`, configured Supabase `apikey`, input limits, user continuity validation, and generic provider failures. Exchange gained the same exact `Origin` validation and delegates replay rejection to Supabase instead of a process-local `Set`.

### TDD evidence
#### RED
- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` initially failed for the absent worker auth import/singleton, direct Options ownership, permissive redirect, direct Supabase refresh, and missing Chrome sender handler.
- `pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts` initially failed because the refresh route was absent, exchange returned the in-memory replay `409`, and exchange ignored a wrong HTTP Origin.
- A subsequent Options-boundary regression failed on `.get(null)`, proving that the Options cache action still enumerated local storage before it moved behind the worker command.

#### GREEN
- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 8/8 passed.
- `pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts` — 4/4 passed.

### Full verification
- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus
The deployment must register the stable `chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp/supabase` redirect and configure the matching `EXTENSION_REDIRECT_ORIGIN`; run a deployed Chrome sign-in/refresh smoke test to confirm the browser-supplied `Origin` reaches the server as expected. A fresh independent review remains required.
