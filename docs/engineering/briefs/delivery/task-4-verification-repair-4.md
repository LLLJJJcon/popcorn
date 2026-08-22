# Delivery Task 4 Verification Repair 4 — Export local CI settings before verify

## Assignment

- Parent: revised Delivery Task 4 final fresh-clone gate.
- Baseline/HEAD: `1ad2a5bf1d0bed85d48cf2cceb1b2c041cebae51`.
- Worktree: `/private/tmp/popcorn-delivery-4`.

## Ownership

Implementation Agent may modify only:

- `tests/release/ci-scope.test.ts`;
- `tests/provenance/no-llm-wiki-code.test.ts`;
- create `docs/engineering/handoffs/delivery/task-4-verification-repair-4.md`;
- this brief.

Controller exclusively owns `.github/workflows/ci.yml` and will change it after RED. Every other file is forbidden.

## RED and root cause

After all test suites passed (unit 190, contract 181, integration 330, provenance 11), `CI=true pnpm verify` failed only in `next build`: `/practice` reads the accepted Supabase/app server configuration during page-data collection, but the workflow currently starts Supabase and exports local fixture values **after** `pnpm verify`.

The Controller proved `CI=true pnpm build` passes when `APP_URL`, local Supabase URL/anon/service-role, and fixed local job secret are exported from the active local Supabase status before the build. No Provider key or live network is needed.

## TDD protocol

1. Update both CI source contracts to require this safe order:
   frozen install → local Supabase start → local status/source/export → `pnpm verify` → `pnpm test:extension` → clean reset/pgTAP → browser/package/check/acceptance → patch check → always teardown.
2. Run focused tests and report RED caused only by the current workflow order.
3. Do not edit CI. Wait for Controller wiring.
4. After Controller commit, rerun focused/full source contracts, scoped ESLint, and diff check; commit tests and separate handoff.

The tests must preserve the one-job, fixture-only, local-derived service role, no GitHub/Provider credentials, no three concurrency/vendor push gates, event-range whitespace, package/check/acceptance, and exact dependency/provenance assertions. Do not introduce YAML dependencies or a commercial CI matrix.

## Verification

```bash
CI=true pnpm vitest run tests/release/ci-scope.test.ts tests/provenance/no-llm-wiki-code.test.ts
CI=true pnpm eslint tests/release/ci-scope.test.ts tests/provenance/no-llm-wiki-code.test.ts
git diff --check
```

No upstream or license change is involved. Return implementation/handoff SHAs and do not integrate or push.
