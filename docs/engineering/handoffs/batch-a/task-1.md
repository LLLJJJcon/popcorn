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

## 2026-08-17 GoTrue compatibility review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Reviewed head fixed: `3bedeaa4b37946a058d0978ae949a064394292d0`.

### Corrections

- The manual GoTrue authorization request now uses the required lowercase `code_challenge_method=s256` and retains exactly one extension-generated challenge.
- Popcorn state is no longer supplied as GoTrue's top-level OAuth `state`. The exact validated extension redirect instead carries one `popcorn_state` query parameter; GoTrue may own and return its own top-level state without changing Popcorn's callback validation.
- The callback requires exactly one matching `popcorn_state`, preserves exact extension origin/path validation, rejects duplicate/missing/wrong state and token-shaped URL fields, and exchanges only the authorization code with the stored verifier and base redirect URI.
- The testable exchange/refresh handler factories now live in `src/server/auth/extension-session.ts`; both App Router modules export only `POST`, which restores production-build compatibility without changing their approved security behavior.

### TDD evidence

#### RED

`node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` exited 1 on the rejected head: the authorization page emitted uppercase `S256`, set GoTrue's top-level `state`, and the callback rejected a valid GoTrue-owned top-level state even when the nested Popcorn state was preserved.

The required production build also exited 1 before this correction because Next App Router rejected the named `createExchangeHandler` and `createRefreshHandler` exports from the two `route.ts` modules.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 9/9 passed.
- `pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts` — 4/4 passed.
- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes compile as dynamic routes.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

Deploy the matching stable extension redirect and perform a real GoTrue/Google browser smoke test; this fixture verifies the protocol boundary but does not contact a provider. Worker ownership, sender validation, refresh, exact Origin, and replay handling were deliberately unchanged from the accepted first review-fix surface.

## 2026-08-17 Chrome Identity callback review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Rejected head fixed: `4492a85fd55162c4fc33057da2284ff3bbbf8461`.
- Reviewed controller prerequisite consumed: `e9100b1` (CONTRACT-005).

### Corrections

- The trusted auth owner now derives the exact Chrome Identity callback from the stable runtime ID as `https://<runtime-id>.chromiumapp.org/supabase`; it no longer treats the `chrome-extension://` request origin as the callback origin or accepts a caller override.
- Exchange and refresh retain the Chromium HTTPS callback in `redirectUri`, while HTTP request `Origin` validation now delegates to CONTRACT-005's frozen assertion for the matching `chrome-extension://<runtime-id>` origin.
- Every non-empty callback fragment is rejected before exchange. Coverage includes `access_token`, `refresh_token`, another token-shaped field, and an arbitrary fragment, and proves that no exchange occurs.
- The reviewed lowercase `s256`, nested single `popcorn_state`, exact single code/state, worker ownership, sender validation, refresh mutex, owner binding, sign-out, and storage boundaries remain unchanged.

### TDD evidence

#### RED

- With tests changed first to the real Chromium callback, `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` failed 3 of 9: interactive and cancellation paths rejected Chrome's real callback as an unexpected configured redirect, and a non-empty fragment reached exchange instead of being rejected.
- The focused Vitest run failed 4 of 22 while `src/server/env.test.ts` stayed green: valid exchange/refresh requests received `403` because the rejected implementation compared their `chrome-extension://` request Origin directly with the Chromium HTTPS callback origin.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 9/9 passed.
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts` — 22/22 passed across 3 files.
- The brief's same Vitest command without `CI=true` was also attempted; the local pnpm dependency wrapper stopped before Vitest with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Adding the documented pnpm CI setting was the only operational difference in the successful run.

### Full verification

- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes remain dynamic and the authorization page builds.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

Register the stable Chromium HTTPS callback with Supabase and perform a deployed Chrome/GoTrue browser smoke test. The fixtures verify callback/request-origin separation and fragment rejection but do not exercise Chrome Identity or a live provider end to end. A fresh independent review remains required.

## 2026-08-17 refresh concurrency and PKCE cleanup review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Rejected head fixed: `20147541c68d04db29ac5c66031c461f1863a600`.

### Corrections

- The trusted service-worker auth client now owns a monotonically changing in-memory session generation. Each refresh captures its starting generation and may persist returned tokens only if that generation is still current.
- A confirmed sign-out advances the generation only after any pending-event decision is resolved, waits for the single active refresh to settle, and removes `popcorn_session` afterward as the final session mutation. Returning `requiresDecision: true` leaves the generation and active refresh valid.
- A newly accepted interactive session advances the generation before storing its tokens, preventing an older deferred refresh from overwriting the new account.
- All sign-in work after PKCE persistence—including URL construction, S256 digest, and `launchWebAuthFlow`—is now inside cleanup coverage. Digest and invalid-URL failures clear transient PKCE state without launching or exchanging.
- The real Chromium callback, nested GoTrue state, fragment rejection, sender/storage/owner isolation, one refresh path, and server/page/route boundaries remain unchanged. This is original concurrency and cleanup work; no GPLv3 material was copied.

### TDD evidence

#### RED

`node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` exited 1 on the rejected head with 10/14 passing and 4/14 failing:

- digest rejection left `popcorn_pkce` persisted;
- invalid app URL construction left `popcorn_pkce` persisted;
- confirmed sign-out settled before the deferred refresh and allowed the refresh to restore the session;
- an old deferred refresh overwrote a subsequently accepted new interactive session.

The deterministic pending-event decision regression remained green, proving the existing `requiresDecision: true` path preserved the active session before implementation.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 14/14 passed.
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts` — 22/22 passed across 3 files.

### Full verification

- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes remain dynamic and the authorization page builds.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

The deterministic tests exercise deferred Provider responses and mocked Chrome storage, not a suspended/restarted MV3 worker or live Chrome storage scheduling. A worker restart also discards all in-flight promises, so the generation intentionally remains worker-local. Perform deployed Chrome/GoTrue sign-in, refresh, decision-required sign-out, and confirmed sign-out smoke tests. A fresh independent review remains required.

## 2026-08-17 invalidated refresh result review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Rejected head fixed: `ad67dc378d9ce8c5008d26e5475216e8ab65d291`.

### Corrections

- An invalidated refresh no longer merely skips persistence and then returns the old account's Provider access token. It now throws the bounded `Popcorn session was invalidated.` error and exposes no token to its waiting caller.
- `refreshSession` validates its captured generation immediately before starting session persistence and again after the awaited persistence completes. Either mismatch rejects the shared refresh promise before the refreshed token return.
- Confirmed sign-out still invalidates first, catches/waits for the active refresh rejection, and removes the session as the final mutation. A newly accepted interactive session still wins storage, while `requiresDecision: true` leaves the active refresh valid and resolving normally.
- No second refresh/token path was added; all earlier PKCE, Chromium callback/request-Origin, worker/sender/storage, owner/sign-out, route, upstream, and license boundaries remain unchanged.

### TDD evidence

#### RED

After changing only the two Fix 4 race assertions, `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` exited 1 with 12/14 passing and 2/14 failing. Both failures were `Missing expected rejection`, proving rejected head `ad67dc3` still resolved invalidated refresh callers with `stale-refreshed`. The final sign-out/new-login storage assertions and the successful decision-required refresh coverage were retained.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 14/14 passed.
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts` — 22/22 passed across 3 files.

### Full verification

- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes remain dynamic and the authorization page builds.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

The deterministic races use mocked Chrome storage rather than a live MV3 worker and real asynchronous storage scheduling. Perform deployed sign-in/refresh plus confirmed and decision-required sign-out smoke tests, and verify invalidated callers receive only the bounded error. A fresh independent review remains required.

## 2026-08-17 serialized session mutation review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Rejected head fixed: `f35417c618a68407be70bd0236310326584d8b4f`.

### Corrections

- Every `popcorn_session` mutation—refresh write, accepted-login write, and confirmed-sign-out removal—now runs through one service-worker-local promise queue. Each caller receives its own result, while a recovered queue tail prevents a rejected mutation from poisoning later work.
- A refresh holds its mutation turn while checking the captured generation, reading and exactly identifying its original stored session, writing the refreshed session, and rechecking generation. Any mismatch rejects with the bounded invalidation error and returns no token.
- A newly accepted login invalidates older work before queuing a generation-guarded write. Confirmed sign-out invalidates, waits/catches the active refresh, then queues a generation-guarded removal. Pre/post guards plus queue ordering make the newer login or sign-out the final winner in both overlap directions.
- `requiresDecision: true` still performs no generation change or session mutation. No generation or token is persisted/exposed, no second refresh path was added, and all approved PKCE, Origin, worker/sender/storage, owner, route, MIT-upstream, and GPL-isolation boundaries remain unchanged.

### TDD evidence

#### RED

- The required deferred `chrome.storage.local.set` test first reproduced rejected head `f35417c`: the old refresh promise rejected after its generation post-check, but its delayed storage write completed after the new login and left `stale-refreshed` as the final stored session.
- With stored-session identity and both login/sign-out overlap regressions added, `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` exited 1 with 14/18 passing and 4/18 failing: stale refresh final overwrite, missing source-session identity rejection, older sign-out resolving/removing across a newer login, and older login resolving/writing across a newer sign-out.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 18/18 passed. The adversarial refresh mutation rejects, the queue recovers, and the queued new login becomes final.
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts` — 22/22 passed across 3 files.

### Full verification

- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes remain dynamic and the authorization page builds.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

The queue and generation are intentionally worker-local and the deterministic tests use mocked delayed Chrome storage calls. Perform live MV3 suspend/restart and storage-scheduling smoke tests around refresh/login/sign-out overlaps; an actual worker termination also discards its in-flight promises and queue. A fresh independent review remains required.

## 2026-08-17 final refresh return guard review-fix addendum

- Status: ready for a fresh independent re-review; this addendum does not self-approve Task 1.
- Rejected head fixed: `2dc7200d66b7864ef89c83319d037e67ab62987c`.

### Correction

After `refreshSession` awaits its queued mutation, it now synchronously reasserts the captured generation immediately before returning `refreshed.accessToken`. There is no await, callback, or other boundary between this final check and the return. The mutation queue, source-session identity comparison, pre/in/post-write checks, all prior 18 race tests, and every approved PKCE, Origin, worker, owner, upstream, and license boundary remain unchanged.

### TDD evidence

#### RED

The new deterministic test deferred both the refresh storage completion and sign-out's pending-events read. It released the storage promise first, then queued the pending-read release so the mutation callback's post-write check passed before sign-out advanced generation, while sign-out still invalidated before the awaiting `refreshSession` continuation returned. On rejected head `2dc7200`, `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` exited 1 with 18/19 passing; the sole failure was `Missing expected rejection`, proving the stale token still resolved.

#### GREEN

- `node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js` — 19/19 passed; the exact reviewer sequence now rejects and confirmed sign-out leaves the session absent.
- `CI=true pnpm vitest run tests/integration/extension/auth-exchange.test.ts tests/integration/extension/auth-refresh.test.ts src/server/env.test.ts` — 22/22 passed across 3 files.

### Full verification

- `CI=true pnpm lint` — passed.
- `CI=true pnpm typecheck` — passed.
- `CI=true pnpm build` — passed; both extension session routes remain dynamic and the authorization page builds.
- `CI=true pnpm test:contract` — 128/128 passed.
- `CI=true pnpm test:provenance` — 11/11 passed.
- `CI=true pnpm test:extension` — 4/4 passed.
- `git diff --check` — passed.

### Residual risk and reviewer focus

The regression controls JavaScript promise reactions deterministically but still uses mocked Chrome storage. Perform a live MV3 storage-scheduling and suspend/restart smoke test; worker termination discards the intentionally local generation and queue together with its in-flight callers. A fresh independent review remains required.
