# Controller Contract Gate — Chrome Identity redirect semantics

## Identity

- Trigger: Batch A Task 1 independent re-review of `b258e49..4492a85`.
- Baseline: `e9f3d292da3dd7ff352d8ba4ea232831ded9cc85`.
- Worktree: `/private/tmp/popcorn-extension-identity-contract`.
- Plan: Batch A Task 1, PKCE through `chrome.identity.launchWebAuthFlow`.

## Scope

Allowed:

- `src/server/env.ts`
- `src/server/env.test.ts`
- `.env.example` only if a clarifying non-secret comment is needed
- this brief and `docs/engineering/handoffs/batch-a/contract-extension-identity.md`

Forbidden: extension implementation, auth routes/pages, migrations, generated types,
dependencies, lockfile, ledger, and all other files.

## Contract

- `EXTENSION_REDIRECT_ORIGIN` is the exact Chrome Identity web-auth origin
  `https://<stable-extension-id>.chromiumapp.org` (no path, query, fragment,
  credentials, port, wildcard, or trailing slash).
- The extension request origin is a separate derived value
  `chrome-extension://<same-extension-id>`; expose a typed pure helper so Task 1
  server routes do not confuse the two origins.
- The extension ID is exactly 32 lowercase characters in Chrome's `a` through
  `p` alphabet.
- Reject a request origin or redirect origin that cannot prove the same ID.
- Keep credentials server-only and do not introduce another environment value.

Consumes: stable manifest extension identity and Chrome Identity redirect format.
Produces: validated callback origin and derived extension request origin.

## TDD and verification

1. RED tests must reject the former `chrome-extension://...` value, malformed
   Chromium hosts, paths/ports/query/fragment, and mismatched request origins;
   they must assert exact derivation for a valid stable ID.
2. Implement only the minimum schema/helper change.
3. Run:
   - `pnpm vitest run src/server/env.test.ts`
   - `CI=true pnpm typecheck`
   - `CI=true pnpm test:contract`
   - `CI=true pnpm build`
   - `git diff --check`
4. Commit and write the handoff with RED/GREEN evidence, SHA, risks, and exact
   files.

## Provenance and license

This is an environment/security contract fix based on Chrome Identity API
semantics. No YouTube Digest or LLM Wiki source is copied. Existing MIT/GPLv3
isolation remains unchanged.
