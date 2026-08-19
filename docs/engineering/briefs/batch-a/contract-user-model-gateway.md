# CONTRACT-008 User Model Gateway Contract Brief

## Task, baseline, and workspace

- Plan: `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 1.
- Baseline commit: `6fbf2e9`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned task; no feature Agent may edit these files.

## Allowed files

- `supabase/migrations/202608160008_user_model_gateway_config.sql`
- `supabase/tests/model_gateway.sql`
- `src/contracts/model-gateway.ts`
- `src/contracts/api.ts`
- `src/contracts/index.ts`
- `tests/contract/model-gateway.test.ts`
- `tests/contract/shared-contracts.test.ts`（仅新增错误码的冻结 taxonomy）
- `src/types/database.generated.ts`
- this brief, its handoff, and `docs/engineering/execution-ledger.md`

Every other path is forbidden. Root configuration and lockfiles remain unchanged.

## Interfaces

- Consumes: authenticated Popcorn user identity, administrator-managed exact
  HTTPS origin catalog, Supabase Vault, durable learning-artifact jobs.
- Produces: provider-neutral origin/config/view/write/consent/rotation contracts;
  owner-scoped non-secret config metadata; immutable consent evidence;
  service-role-only Vault create/resolve/rotate/revoke RPCs.
- API keys are write-only inputs. Public schemas and rows expose only
  `hasApiKey`; Vault UUIDs and decrypted secrets stay behind service role.
- V1 supports only `openai-compatible`, one active config per user, and catalog
  destinations. Unknown adapters and arbitrary URLs fail closed.

## TDD evidence

RED must show the new TypeScript contract module and database objects are absent.
GREEN must prove strict input/view boundaries, exact origin matching, two-user
isolation, authenticated read-only metadata, no secret-table privileges, one
active version, safe rotation/revocation, and service-role-only resolution.

## Verification

```bash
./node_modules/.bin/vitest run tests/contract/model-gateway.test.ts
./node_modules/.bin/supabase db reset
./node_modules/.bin/supabase test db
./node_modules/.bin/supabase gen types typescript --local
./node_modules/.bin/vitest run tests/contract
./node_modules/.bin/vitest run tests/provenance
./node_modules/.bin/tsc --noEmit
pnpm build
git diff --check
```

## Upstream and license

No upstream implementation is applicable. YouTube Digest remains MIT vendored
only in the extension; this contract copies none of its code. LLM Wiki contributes
only the already-approved method of keeping provider work server-side; copy no
GPLv3 code, tests, prompts, components, or assets.
