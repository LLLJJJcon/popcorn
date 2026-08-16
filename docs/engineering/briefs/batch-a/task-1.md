# Batch A Task 1 Brief — Link the extension to Popcorn accounts

## Identity and baseline

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 1.
- Baseline/checkpoint: `b258e49fb745eac0309de3fcb6848e87ef43979f`; frozen implementation contracts/migrations at `c790118dc89297af965dee8048a2722a98bee802`.
- Branch/worktree: `codex/popcorn-batch-a-1` at `/private/tmp/popcorn-batch-a-1`.
- Parallel wave peers own Batch A Tasks 2 and 4 in other worktrees. Do not edit their files or Task 3+ paths.

## Allowed files

Only modify/create:

- `extension/manifest.json`
- `extension/options.html`
- `extension/options.css`
- `extension/options.js`
- `extension/settings.js`
- `extension/auth.js`
- `extension/tests/auth.test.js`
- `src/app/auth/extension/page.tsx`
- `src/app/api/v1/extension/session/exchange/route.ts`
- `tests/integration/extension/auth-exchange.test.ts`
- `docs/engineering/briefs/batch-a/task-1.md` (commit unchanged)
- `docs/engineering/handoffs/batch-a/task-1.md` (create/append)

Forbidden: `src/contracts/**`, `src/server/env.ts`, all migrations/generated types/root config/lockfile, `extension/background.js`, Side Panel/content scripts, other extension tests, ledger/checkpoints, and every Batch A Task 2–7 file. Manifest changes are shared-surface candidates and must be explicitly itemized in the handoff for controller review.

## Consumed/produced interfaces and security boundary

- Consume frozen `EXTENSION_REDIRECT_ORIGIN` (`chrome-extension://` plus exact 32-letter ID), Supabase PKCE, Chrome 116+, and `chrome.identity.launchWebAuthFlow`.
- Produce `beginInteractiveSignIn`, `getSession`, `getAccessToken`, `signOut`, and exactly one refresh mutex in trusted extension contexts.
- Content scripts are page-adjacent/untrusted and must never receive access/refresh tokens, PKCE verifier/state, provider keys, or cached cloud payloads. Restrict `chrome.storage.local` and `chrome.storage.session` access levels to trusted contexts where supported.
- Interactive auth begins only from a user click. Generate a high-entropy verifier/state with Web Crypto, derive S256 challenge, persist verifier/state/redirect/expiry in `chrome.storage.session` before opening the flow, validate callback scheme/origin/state/code, and clear PKCE material on success, cancel/error/expiry/sign-out.
- The one-time code and verifier are POSTed in the body to the exchange route. Tokens must never appear in the sign-in URL, callback query, logs, content messages, or DOM.
- The server route accepts only the exact configured Chrome redirect origin/URI, validates bounded JSON, exchanges the PKCE code through Supabase Auth, returns a bounded session envelope, sets `Cache-Control: no-store`, and never logs/returns Supabase provider error bodies. Do not add a custom authorization-code table.
- Pending local sync descriptors are counted and owner-bound. `signOut` returns `{pendingCount}` and does not silently discard/upload another user's events; UI requires sync-first or explicit discard before clearing the session.
- Use a stable public manifest key (never a private key/secret) and document the derived extension ID/origin so unpacked redirects are deterministic.

## Upstream reuse and license

- Source: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT.
- Adapt in place: `manifest.json`; `options.html`, `options.css`; `options.js:createStorageAdapter`, `initialize`, cached-data controls; `settings.js:STORAGE_KEY`, `normalize`, `migrateLegacyCustom`.
- Remove Supadata/DeepSeek key fields, model/custom-provider UI/copy, provider URLs, `checkConfig`/provider settings. Preserve the existing options structure, accessible controls, storage adapter behavior, bounded cache controls, and MIT attribution; do not build a parallel settings app.
- The handoff must list each source file/function, target, adaptation, license action, and reused/new test. No LLM Wiki method or code applies.

## Strict TDD

Write both test files before production changes. Capture RED from:

```bash
node --test extension/tests/auth.test.js
pnpm vitest run tests/integration/extension/auth-exchange.test.ts
```

At minimum prove:

- no auth flow before click; exact `getRedirectURL("supabase")`; PKCE state stored before launch; valid state/origin required; cleanup on all terminal paths;
- tokens stored only under `popcorn_session` in trusted local storage; session storage holds only bounded transient PKCE data; content-script messages cannot request/read tokens;
- two simultaneous token requests make one refresh; refresh success/error is shared and the mutex clears for later attempts; expired session never falls back to another user's token;
- sign-out reports owner-bound pending count and requires sync/discard; account switch quarantines old-owner events;
- manifest has stable key, minimum Chrome 116, `identity` and `alarms`, keeps required Side Panel/storage/tabs/scripting permissions, and contains only YouTube plus configured Popcorn API/auth hosts—no Supadata/DeepSeek/OpenAI host;
- options contains account email, sign-in/out, sync status, clear bounded cache, discard pending; contains no provider key/model/customization fields;
- exchange rejects wrong origin/redirect/state shape, missing/oversized fields, provider failure leakage, replay response, or tokens in URL; valid exchange calls the Supabase token endpoint once and returns only schema-bounded session data with `no-store`.

Use deterministic fakes for Chrome, fetch, Web Crypto boundaries, and Supabase HTTP. No real account/network call in CI.

## Verification

Run and record:

```bash
node --test extension/tests/auth.test.js
pnpm vitest run tests/integration/extension/auth-exchange.test.ts
CI=true pnpm typecheck
CI=true pnpm test:contract
CI=true pnpm test:provenance
pnpm test:extension
git diff --check
git status --short
```

Commit scoped work as `feat: link the extension to Popcorn accounts`. Handoff must include baseline/head, RED/GREEN, exact manifest permission/host/key diff, PKCE/token/storage/message boundary, upstream function ledger, license action, changed files, risks, and clean status. Return SHA/results/risks/path; do not self-approve.
