# Batch A Task 1 GoTrue Compatibility Review Fix

## Identity

- Original task baseline: `b258e49fb745eac0309de3fcb6848e87ef43979f`.
- Second rejected head: `3bedeaa4b37946a058d0978ae949a064394292d0`.
- Worktree: `/private/tmp/popcorn-batch-a-1`.
- Independent re-review confirmed the worker/session/sender/refresh/origin/replay fixes and rejected only two real GoTrue authorization compatibility defects.

## Allowed files

- `extension/auth.js`
- `extension/tests/auth.test.js`
- `src/app/auth/extension/page.tsx`
- `src/app/api/v1/extension/session/exchange/route.ts`
- `src/app/api/v1/extension/session/refresh/route.ts`
- create `src/server/auth/extension-session.ts` as the sole testable handler/factory module
- `tests/integration/extension/auth-exchange.test.ts` (or create one page-focused test under the same `tests/integration/extension/` directory)
- `tests/integration/extension/auth-refresh.test.ts`
- this brief
- append `docs/engineering/handoffs/batch-a/task-1.md`

No other file may change.

The production-build RED additionally proves Next App Router rejects named factory exports from both `route.ts` files. Move schemas/factories into the allowed server helper, update test imports, and leave each route module with only the supported `POST` export. Preserve behavior and rerun the production build.

## Required RED/GREEN

First add tests that fail on `3bedeaa` and prove:

1. The Supabase `/auth/v1/authorize` URL contains exactly one external PKCE challenge and uses exact lowercase `code_challenge_method=s256` required by GoTrue.
2. Popcorn's extension state is **not** sent as GoTrue's top-level OAuth `state`. GoTrue owns its Provider state. Instead, place the bounded Popcorn state in a uniquely named query parameter of the already exact-validated `redirect_to` URL (for example `popcorn_state`).
3. Simulate GoTrue preserving that nested redirect query and appending the authorization `code`; the extension callback must accept exactly one matching Popcorn state, validate the same exact redirect origin/path, reject missing/duplicate/wrong state, reject token URL fields, and POST only code/verifier/base redirect URI to exchange.
4. Wrong extension redirect remains rejected before authorization. Tokens/verifier never enter authorization/callback URLs.

Implementation must not reintroduce Supabase Auth JS PKCE generation, a caller-controlled GoTrue `state`, process-memory replay tracking, UI session ownership, or any change to the already-approved worker/refresh boundary. Keep CI fixture-only.

Run focused auth Node/Vitest, typecheck, production build, contract/provenance/extension gates and `git diff --check`; append exact RED/GREEN evidence and commit. A fresh independent re-review is mandatory.

No upstream code is copied. YouTube Digest MIT adaptation and LLM Wiki GPL isolation remain unchanged.
