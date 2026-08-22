# Delivery Task 4 verification repair 4 handoff

## Result

- Implementation commit: `2c5b146a26f9d7e4b930d600ef024444697cc8de`
- Brief commit: `038e492366a9d6622020185f1011ece35d687279`
- Controller workflow commit: `80df29f2bb0c78ac1d424ba486ae932a51394a4e`
- Worktree/branch: `/private/tmp/popcorn-delivery-4`, `codex/popcorn-delivery-4`
- No integration or push was performed.

## RED and root cause

The Controller's full verify passed all test suites (unit 190, contract 181,
integration 330, provenance 11) and then failed only during `next build`.
`/practice` reads the accepted app/Supabase configuration during page-data
collection, but CI ran `pnpm verify` before starting local Supabase and
exporting its fixture settings.

The Controller separately proved the production build passes when `APP_URL`,
local Supabase URL/anon/service-role, database URL, and the fixed local job
secret are exported before the build. No Provider key or live network was
needed.

Test-first RED before Controller wiring:

- `CI=true pnpm vitest run tests/release/ci-scope.test.ts tests/provenance/no-llm-wiki-code.test.ts`: 2 failed / 13 passed.
- Both failures were ordering-only: `pnpm verify` appeared at offset 757,
  before the required local status/source/export sequence ending at offset
  1569.
- No workflow edit was made by the implementation Agent. Work paused until
  Controller commit `80df29f2bb0c78ac1d424ba486ae932a51394a4e` landed.

## Change

Only the two allowed source contracts changed:

- `tests/release/ci-scope.test.ts`
- `tests/provenance/no-llm-wiki-code.test.ts`

Both now require this order:

1. Frozen dependency install.
2. Local Supabase start.
3. Local `supabase status -o env`, source, and export of `APP_URL`, local
   Supabase URL/anon/service-role, database URL, and fixed fixture job secret.
4. `pnpm verify` and the pinned extension test.
5. Clean reset and pgTAP.
6. Browser install, extension package/release check, and top-level fixture
   acceptance.
7. Event patch whitespace check.
8. Always-run local Supabase teardown.

Existing one-job, fixture-only, read-only permissions, locally derived role,
no GitHub/Provider credentials, no repeated concurrency/vendor gates,
event-range fallback, dependency freeze, and upstream provenance assertions
remain intact.

No runtime, workflow, acceptance, package, lockfile, migration, generated,
license, or other test file changed in the implementation commit.

## GREEN evidence

- `CI=true pnpm vitest run tests/release/ci-scope.test.ts tests/provenance/no-llm-wiki-code.test.ts`: 15/15 passed.
- `CI=true pnpm eslint tests/release/ci-scope.test.ts tests/provenance/no-llm-wiki-code.test.ts`: exit 0.
- `git diff --check`: exit 0.
- Controller evidence: production build passes when the accepted local fixture
  environment is exported before verification.
- Final independent read-only re-review: no findings; ready.

## Risks and licensing

- CI now requires local Supabase to be ready before `verify`; the always-run
  teardown remains the final gate even when an earlier step fails.
- The source contracts intentionally freeze exact local variable/export names.
  A deliberate CI interface change must update both contracts in the same
  reviewed change.
- No upstream content was fetched or copied, and no license or provenance
  result changed.
