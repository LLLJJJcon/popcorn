# Batch C Task 1 handoff — bounded Chinese Vault search

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 1.
- Baseline: `8d4ec2c`; brief commit: `e7ea90f`.
- Worktree: `/private/tmp/popcorn-batch-c-1`.

## Implementation

- Added strict bounded URL/query and public result schemas for query text,
  communicative function, register, source, mastery, half-open date bounds, and
  limits up to 50.
- Added an authenticated repository that invokes the frozen
  `search_expressions` RPC exactly once with the authenticated owner. It maps
  the returned rows without ranking, slicing, normalizing, or reordering them,
  and fails closed on malformed or unexpected result fields.
- Preserved the existing no-query `/api/v1/vault` card-list response. Search
  requests use the same route only when a search parameter is present and
  return the stable success/failure envelope with `no-store`.
- Added a debounced accessible Vault search with all first-release filters,
  explicit loading/empty/error states, source count, mastery and match reason,
  result links, Arrow Up/Down navigation, and one Clear filters action.
- Kept the existing authenticated Vault page and full `VaultList` beneath the
  search surface, so unfiltered cards, evidence, attempts, and source links are
  unchanged.

## TDD evidence

RED command:

```bash
CI=true pnpm vitest run src/server/repositories/expression-search-repository.test.ts src/features/vault/vault-search.test.tsx
```

RED result: exit 1. Both suites failed import resolution because
`expression-search-repository.ts` and `vault-search.tsx` did not exist. This
was the expected missing-feature failure before production code was added.

GREEN for the same command: 2 files and 9 tests passed. The repository tests
cover exact/substring/trigram and all frozen match reasons, empty-query recent
results, complete filter/limit forwarding, preserved RPC order, authenticated
owner forwarding, validation errors, generic internal errors, and malformed or
cross-owner-shaped output rejection. UI tests cover debounce, all filters,
Chinese result presentation, match/source/mastery evidence, keyboard movement,
clear-filter behavior, and generic loading/error handling.

## Verification

```bash
CI=true pnpm vitest run src/server/repositories/expression-search-repository.test.ts src/features/vault/vault-search.test.tsx tests/integration/memory/vault-practice.test.ts src/app/page.test.tsx
CI=true pnpm exec eslint src/features/vault/search-schema.ts src/server/repositories/expression-search-repository.ts src/features/vault/vault-search.tsx src/app/api/v1/vault/route.ts 'src/app/(app)/vault/page.tsx' src/server/repositories/expression-search-repository.test.ts src/features/vault/vault-search.test.tsx
CI=true pnpm typecheck
git diff --check
```

The focused and directly affected regression set passed 4 files / 18 tests;
scoped ESLint had no warnings, TypeScript exited 0, and diff-check exited 0.
No DB reset or pgTAP was rerun because CONTRACT-014 already froze and verified
the RPC and this task did not change SQL or generated types.

## Scope, provenance, and residual risk

- Only the brief allowlist was changed. No migration, generated type, shared
  contract, root configuration, lockfile, Provider, gateway, extension, or
  existing Vault component was modified.
- LLM Wiki contributed only the documented relational staged-retrieval method;
  no GPLv3 implementation, test, prompt, component, or asset was copied.
- The pinned YouTube Digest MIT adaptation remains unchanged.
- Trigram behavior and the 0.2 similarity threshold remain the frozen database
  contract. Personal usage may motivate later tuning, but this feature does not
  duplicate or override that ranking.

## Review repair 1 — request ordering and retry

- Repair brief baseline: `e437d297058d720dd858223a06241b6e9342367d`.
- Implementation commit: `91e965e191e2195a4d9d5d717ed38cb64ba5c995`.
- Added deterministic coverage for a newer request resolving before an older
  success, a newer success followed by an older failure, and retrying the
  initial empty-filter request with exactly the same URL.
- Added an effect-lifetime cancellation fence. A request whose filters were
  replaced, whose retry generation was replaced, or whose component unmounted
  cannot publish loading, results, or error state.
- Added an accessible `Retry search` action. Retry changes only an internal
  generation counter, so the existing filter values and server ordering remain
  unchanged.

Repair RED command:

```bash
CI=true pnpm vitest run src/features/vault/vault-search.test.tsx
```

Repair RED result: exit 1, with 3 expected failures. The old success replaced
the newer result, the old failure replaced the newer result with the generic
error, and no accessible `Retry search` button existed.

Repair GREEN and verification:

```bash
CI=true pnpm vitest run src/features/vault/vault-search.test.tsx
./node_modules/.bin/eslint src/features/vault/vault-search.tsx src/features/vault/vault-search.test.tsx
./node_modules/.bin/tsc --noEmit
git diff --check
```

The focused suite passed 1 file / 7 tests. Scoped ESLint, TypeScript, and
diff-check each exited 0. The repair changed only the two allowed Vault search
files plus this handoff; no repository, route, contract, database, generated
type, root configuration, lockfile, Provider, gateway, extension, or upstream
adaptation changed.
