# CONTRACT-008 Review Fix 1

## Trigger

Independent review of `6fbf2e9..bd6c91d` returned FAIL. Baseline for this fix
is `bd6c91d` in `/private/tmp/popcorn-youtube-learning`.

## Blocking findings to close

1. Reject IP literals, localhost/local/internal/metadata destinations in both
   Zod and SQL catalog validation.
2. Remove direct service-role mutation of owner configuration rows. Creation,
   activation, rename, rotation, and revocation must pass only through bounded
   SECURITY DEFINER RPCs.
3. Prevent semantic changes to a catalog origin once a user config references
   it, so pinned configuration fingerprints cannot diverge from runtime paths.
4. Add a rename-only RPC and frozen rename/revoke/settings-view DTOs.
5. Revocation must mark an owned active/pending config revoked even if its
   secret mapping is already missing, and must be idempotent for an owned
   already-revoked config.
6. Freeze service-role-only privileges for all secret/lifecycle RPCs.

## Allowed files

- `supabase/migrations/202608160008_user_model_gateway_config.sql`
- `supabase/tests/model_gateway.sql`
- `tests/contract/model-gateway-concurrency.sh`
- `.github/workflows/ci.yml`（仅增加并发契约门禁）
- `tests/provenance/no-llm-wiki-code.test.ts`（仅冻结该 CI 命令）
- `src/contracts/model-gateway.ts`
- `tests/contract/model-gateway.test.ts`
- `src/types/database.generated.ts`
- this brief, CONTRACT-008 handoff, and execution ledger after PASS

No routes, adapters, extension files, root config, dependencies, or lockfile.

## TDD and verification

Add failing counterexamples first, capture RED, make the minimum contract fix,
then run two clean resets, full pgTAP, full contracts/provenance, lint,
typecheck, production build, generated-type check, and `git diff --check`.
