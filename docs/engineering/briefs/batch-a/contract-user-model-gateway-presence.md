# CONTRACT-008A Credential Presence Brief

## Task, baseline, and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`,
  Task 2 prerequisite.
- Baseline commit: `8bd4504`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned contract amendment; no feature Agent edits these files.

## Allowed files

- `supabase/migrations/202608160008_user_model_gateway_config.sql`
- `supabase/tests/model_gateway.sql`
- `src/types/database.generated.ts`
- this brief, its handoff, and `docs/engineering/execution-ledger.md`

All application services, routes, UI, root configuration, lockfiles, extension
files, and learning-artifact files are forbidden.

## Interfaces

- Consumes: authenticated owner identity at the future settings service boundary,
  immutable gateway config ID, and the private Vault-reference mapping.
- Produces: one service-role-only, owner-bound boolean RPC indicating whether a
  pending or active config has a secret mapping.
- The RPC must not join `vault.decrypted_secrets`, return a Vault UUID, disclose
  a key, or allow anon/authenticated execution.

## TDD evidence and verification

RED must fail because `has_user_model_gateway_secret(uuid, uuid)` does not exist.
GREEN must cover present, wrong-owner, revoked, and corrupt missing-mapping cases.

```bash
./node_modules/.bin/supabase db reset --local
./node_modules/.bin/supabase test db supabase/tests/model_gateway.sql
./node_modules/.bin/supabase test db
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/tsc --noEmit
diff -u src/types/database.generated.ts <(./node_modules/.bin/supabase gen types typescript --local)
pnpm build
git diff --check
```

## Upstream and license

No upstream implementation applies. Do not copy YouTube Digest code. LLM Wiki
remains method-only GPLv3 inspiration; copy no code, tests, prompts, components,
or assets.
