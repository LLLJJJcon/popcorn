# Foundation Task 5 Brief — Scheduled recovery, CI, and frozen ownership

## Identity and baseline

- Plan and task: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 5.
- Baseline commit: `04817e98e565f7e0c12f5d1916f96ff87edcbf9e`.
- Branch/worktree: `codex/popcorn-foundation-5` at `/private/tmp/popcorn-foundation-5`.
- Consumes all reviewed Foundation Tasks 1–4. This task freezes the baseline; do not start Batch A or implement the future internal processor endpoint.

## Allowed and forbidden files

Allowed only:

- `supabase/migrations/202608160003_cron.sql`
- `.github/workflows/ci.yml`
- `docs/engineering/agent-boundaries.md`
- `docs/engineering/upstream-reuse-policy.md`
- `package.json` (scripts only; no dependency changes)
- `extension/tests/package.json` (test-module boundary only: `{ "type": "commonjs" }`)
- `tests/provenance/no-llm-wiki-code.test.ts`
- `docs/engineering/briefs/foundation/task-5.md` (commit unchanged)
- `docs/engineering/handoffs/foundation/task-5.md` (create/append)

Forbidden: every other file, including `pnpm-lock.yaml`, frozen `src/contracts/**`, Task 4 domain rules, existing migrations 001/002, generated types, upstream/vendor content, notices, extension product code/tests, execution ledger, checkpoints, and Batch files. Add no dependency. Stop for a genuine contract/migration conflict rather than weakening prior gates.

## Interfaces consumed and produced

- Consume the frozen migrations/RLS/job lifecycle, `leaseJob` recovery semantics, root scripts, pinned YouTube Digest intake, and existing release static test.
- Produce one migration that installs a named every-minute Supabase Cron job. Its stored command must read both the full HTTPS internal processor endpoint and bearer secret from Supabase Vault at execution time, then `POST` a small JSON body to `/api/internal/jobs/process` through `pg_net`. Missing/invalid Vault values must result in no request, not a migration failure or embedded credential.
- Produce fixture-only GitHub CI covering frozen install, lint/typecheck/unit/contract/provenance, web build, extension static release check, clean Supabase start/reset/pgTAP, vendor shell syntax, and `git diff --check`. It must never call a live transcript/AI Provider or require provider credentials.
- Produce durable ownership/upstream policies for all later parallel agents and reviewers.
- Add a package script for the existing extension static release test. The controller resolved the intake mismatch as follows: `extension/tests/package.json` declares the vendored tests CommonJS, and the static gate runs the four `release.test.js` cases whose referenced files are present in the Task 1 allowlist (notes-filter accessibility, runtime credential/model hygiene, retired-file absence, and prompt-section presence). The two omitted upstream-only cases require non-vendored YouTube Digest package/README/release-copy artifacts and assert upstream branding/provider state scheduled for later removal; they are not Popcorn Foundation acceptance requirements. The script must use an explicit `--test-name-pattern`, must not copy or rewrite the upstream test, and must leave those four cases visible in TAP output rather than replacing them with a parallel check. Do not change package versions or the lockfile.

## Cron security contract

- Enable `pg_cron` and `pg_net` in the extensions schema using migration-safe SQL.
- Use a stable job name and `* * * * *` schedule. The migration itself must contain no endpoint value, bearer token, `INTERNAL_JOB_SECRET` value, or production credential.
- Vault secret names are `popcorn_internal_job_url` (the full HTTPS URL ending exactly in `/api/internal/jobs/process`) and `popcorn_internal_job_secret` (the bearer value). The scheduled SQL reads `vault.decrypted_secrets`; it does not copy decrypted values into a table or log them.
- Call only when both secrets exist, are nonblank, and the endpoint is HTTPS with the exact path. Send `Content-Type: application/json`, `Authorization: Bearer <secret>`, and a bounded body such as `{ "source": "supabase_cron" }`.
- The future endpoint returns quickly after leasing a bounded batch; do not create it here. Do not call a provider in Cron.
- Keep the migration repeatable under clean `supabase db reset`; no manual secret is required for local/CI migration application.

## Required TDD protocol

Before creating the migration, workflow, policies, or package script, expand `tests/provenance/no-llm-wiki-code.test.ts` and capture a genuine RED run. Tests must fail because the outputs do not yet exist or lack required content. Cover at minimum:

- LLM Wiki method-only policy includes v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6`, exact phrase `MUST NOT copy GPLv3 implementation code`, allowed methods, and forbidden code/tests/prompts/components/assets.
- YouTube Digest policy includes repo, fixed commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT action, and requires every extension task/review to record source repo, pin, source file/function, target, adaptation, license action, and reused test.
- Agent boundary policy reserves contracts, all migrations, generated database types, root config/lockfile, vendor script, notices/shared errors, ledger/checkpoints, and final integration for the controller; max three child Agents; distinct worktrees; no overlapping active file ownership; implementation→fresh read-only review→fix/re-review→controller integration.
- Cron SQL contains the exact schedule, Vault lookups, HTTPS/exact-path guard, POST/headers/bounded body, and no hard-coded URL/secret. Assert the scheduled command uses Vault at run time rather than interpolating a secret during migration.
- CI contains every required gate, starts/stops local Supabase, runs no live Provider, uses no production/provider secret, and invokes the extension static script.
- `package.json` exposes the extension static script without changing dependencies.
- The CommonJS test-boundary file and explicit name pattern run exactly the four compatible upstream release cases and do not silently treat the two unavailable upstream publishing-copy cases as product coverage.

Initial command:

```bash
pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
```

Record RED exit status/assertions in the handoff, then implement only the minimum allowed outputs and reach GREEN. Tests should parse/read artifacts meaningfully; do not merely mirror a weak marker string.

## CI implementation boundary

- Use GitHub-hosted Ubuntu, Node 20, the repository `packageManager` pnpm version, frozen install, a timeout, and least-privilege read-only contents permission.
- CI steps must run: frozen install; `pnpm verify`; `pnpm test:extension`; local Supabase start; `pnpm db:reset`; `pnpm db:test`; `bash -n scripts/vendor-youtube-digest.sh`; `git diff --check`; and always stop Supabase without backup.
- The workflow may use standard setup actions but must not add application dependencies or expose secrets. Fixture-backed tests are the only Provider behavior in CI.
- `test:extension` must execute the existing `extension/tests/release.test.js` with an explicit name pattern for: `notes filters preserve selected contrast and expose pressed state`, `runtime has no source-file credential dependency or retired model`, `retired Remix and reader files are absent`, and `published prompt files contain runtime sections`. `extension/tests/package.json` supplies the CommonJS boundary. Do not create parallel checks or vendor missing upstream release-copy files.

## Upstream and license requirements

- YouTube Digest: `zarazhangrui/youtube-digest` at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. This task reuses the existing adapted `extension/tests/release.test.js` as the static extension gate and preserves `third_party/youtube-digest/LICENSE` plus `THIRD_PARTY_NOTICES.md`; do not copy new upstream files.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at `723e259309aea5e3850265b631f80224f66dd9f6`, GPLv3. Only immutable raw sources, schema-governed structured knowledge, content-addressed result identity, and persistent recoverable queue methods are allowed. Do not copy GPL code, tests, prompts, components, assets, filesystem/vector pipeline, or implementation structure.
- Add no third-party code or dependency; no new license notice should be necessary.

## Verification and handoff

Run and record:

```bash
pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
pnpm test:extension
CI=true pnpm verify
node_modules/.bin/supabase db reset
node_modules/.bin/supabase test db
bash -n scripts/vendor-youtube-digest.sh
git diff --check
git status --short
```

The controller will independently repeat the complete Foundation exit gate and inspect the live Cron catalog after review. Create `docs/engineering/handoffs/foundation/task-5.md` with baseline/head, exact RED/GREEN and broad results, migration/job/secret names, workflow gates, changed files, upstream/license evidence, risks, and confirmation of clean scope. Commit scoped work with `ci: freeze YouTube foundation contracts` and return SHA, tests, risks, and handoff path.
