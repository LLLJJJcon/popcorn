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
