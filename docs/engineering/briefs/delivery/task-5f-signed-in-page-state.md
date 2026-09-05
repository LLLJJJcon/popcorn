# Revised Delivery Task 5F — Signed-in state on `/sign-in`

## Task identity

- Plan/task: Revised Delivery, Task 5F (bounded UX repair requested 2026-09-05)
- Baseline commit: `d8207199c750922b9b5e93c258e900f2832692eb`
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn`
- Branch: `codex/popcorn-youtube-learning`

## Product requirement

The Web `/sign-in` route is also opened from the extension Settings surface.
Today an authenticated user still sees the anonymous email/password form, which
makes the session look lost. Preserve the current Popcorn visual language, but
make the route render mutually exclusive authenticated and anonymous states:

1. Anonymous or expired session: render the existing email/password sign-in and
   create-account form unchanged.
2. Verified session: render a clear signed-in account state with the current
   account email, a link to `/settings/model-gateway`, and the existing exact
   POST `/auth/sign-out` action. Do not render email or password inputs, the
   sign-in button, or the create-account button.
3. If a verified Supabase user unexpectedly lacks an email, show a neutral
   fallback such as `Popcorn account`; do not expose a user UUID.
4. Keep the existing responsive two-panel layout, typography, colors, focus
   styles, and accessible labels.

## Interfaces consumed

- `cookies()` from Next.js server rendering.
- `getModelGatewaySettingsEnv()` for the scoped local Web environment.
- The existing SSR Supabase client/auth handler and its verified `getUser()`
  boundary.
- Existing routes `/settings/model-gateway` and POST `/auth/sign-out`.

## Interfaces produced

- A server-rendered `/sign-in` state based on a verified account.
- A bounded auth read result containing only authenticated state and optional
  email; no password, token, credential, or raw Provider error.

## Allowed files

- `src/app/sign-in/page.tsx`
- `src/app/sign-in/sign-in.module.css`
- `src/app/sign-in/page.test.tsx`
- `src/server/auth/web-auth-flow.ts`
- `src/server/auth/web-auth-flow.test.ts`
- `docs/engineering/handoffs/delivery/task-5f-signed-in-page-state.md`

## Forbidden files

- `src/app/sign-in/sign-in-form.tsx` and its test (anonymous form remains exact)
- Extension files, model-gateway UI/API, worker, Provider, database/migrations,
  shared contracts/types, root configuration, dependencies, lockfile, `.env*`,
  `next-env.d.ts`, generated `AGENTS.md`/`CLAUDE.md`, and execution ledger.

## TDD and expected RED evidence

Before production edits, add tests that fail because the current page always
renders the anonymous form and the current verified auth result exposes only a
boolean. RED must prove:

- a verified user sees their email, settings continuation, and sign-out action;
- the verified state contains no email/password inputs or sign-in/create-account
  buttons;
- anonymous and expired states retain the existing form;
- the auth helper returns only a normalized bounded account state and handles a
  missing email without leaking the UUID.

Then make the minimum implementation required for GREEN. Record the exact RED
and GREEN commands and results in the handoff report.

## Verification commands

```bash
pnpm vitest run src/app/sign-in/page.test.tsx src/app/sign-in/sign-in-form.test.tsx src/server/auth/web-auth-flow.test.ts
pnpm eslint src/app/sign-in/page.tsx src/app/sign-in/page.test.tsx src/server/auth/web-auth-flow.ts src/server/auth/web-auth-flow.test.ts
pnpm typecheck
git diff --check
```

## Upstream and license boundary

- Upstream repositories: none for this task.
- Fixed commits/files/functions reused: existing Popcorn
  `createWebAuthFlowHandlers`, `createPopcornSsrServerClient`, `/auth/sign-out`,
  and `SignInForm`; no parallel authentication implementation.
- YouTube Digest: no applicable file or function; do not modify or copy it.
- LLM Wiki GPLv3: no method is needed; do not copy GPLv3 code, tests, prompts,
  components, or assets.

## Handoff contract

Commit only allowed files. Return status, commit SHA, RED/GREEN and verification
summary, risks, and the report path. Do not spawn subagents.
