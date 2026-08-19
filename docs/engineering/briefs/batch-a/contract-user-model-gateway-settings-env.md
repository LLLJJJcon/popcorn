# CONTRACT-008B Scoped Settings Environment Brief

## Scope

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`,
  Task 2 review prerequisite.
- Baseline: `3d0e6842a4867fb59c07b9abcf6fa444dd794a16`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned files only: `src/server/env.ts`, `src/server/env.test.ts`,
  this brief, its handoff, and the execution ledger.

## Required contract

Expose a strict scoped parser/getter requiring only Supabase URL, anon key,
service-role key, and `APP_URL`. Gateway settings route initialization must not
require legacy OpenAI, Supadata, extension redirect, or job-worker configuration.
The full existing server environment contract remains unchanged for its current
consumers.

## TDD and verification

RED must show the scoped parser is absent. GREEN must accept the four exact
settings dependencies without any legacy Provider fields, reject missing
dependencies and unknown keys at the parser boundary, and preserve all existing
environment tests.

```bash
./node_modules/.bin/vitest run src/server/env.test.ts
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint src tests --max-warnings 0
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build --webpack
git diff --check
```

No upstream implementation applies. Copy no YouTube Digest code and no GPLv3
LLM Wiki code, tests, prompts, components, or assets.
