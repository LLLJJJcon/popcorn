# User Model Gateway Task 3 Review Fix 1 Brief

## Identity and scope

- Plan task: user model gateway Task 3.
- Original baseline: `8c13805`.
- Rejected candidate: `fafc55f8c3802e718ebd6dc6d8924bc737e03886`.
- Fix worktree: `/private/tmp/popcorn-gateway-settings-ui`.
- Fix only the two independent-review blockers with strict RED/GREEN.

Allowed files:

- `src/server/auth/web-auth-flow.ts`
- `src/server/auth/web-auth-flow.test.ts`
- `src/app/settings/model-gateway/model-gateway-settings.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- this brief
- `docs/engineering/handoffs/batch-a/user-model-gateway-settings-ui-review-fix-1.md`

Every other file is forbidden.

## Blocker 1: malformed authorization code

Add parameterized RED tests proving callback rejects malformed codes before
`exchangeCodeForSession`: invalid percent text, NUL/control/newline, Unicode,
HTML/metacharacters, whitespace, overlength, and noncanonical IDs. Use the
Supabase Auth package's documented PKCE authorization-code example/format as
the local pinned source of truth; accept only a canonical authorization UUID
shape, with one code parameter and no extra query key. Do not merely escape or
forward malformed input. Retain one-time flow-cookie clearing and fixed redirect.

## Blocker 2: rename/rotation error association

Add RED accessibility tests for empty rename and empty rotation submission.
The specific invalid input must set `aria-invalid=true` and reference the visible
`role=alert` error via `aria-describedby`. Clear invalid state when the learner
edits the corresponding input or the action succeeds. Do not expose a key in
the error, DOM, state persistence, or test snapshot. Retain immediate rotation
key clearing on every result path.

## Verification

```bash
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx
./node_modules/.bin/vitest run src/server/auth/web-auth-flow.test.ts \
  src/app/sign-in/sign-in-form.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  tests/integration/model-gateway/settings-web-auth.test.ts
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
git status --short
```

No real auth code, email, Provider, or key is permitted. No upstream code
applies; copy no GPLv3 code, tests, prompts, components, styles, or assets.
