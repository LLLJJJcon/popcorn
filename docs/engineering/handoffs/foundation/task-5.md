# Foundation Task 5 Handoff

- Status: DONE_WITH_CONCERNS
- Plan and task: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 5
- Worktree and branch: `/private/tmp/popcorn-foundation-5`, `codex/popcorn-foundation-5`
- Baseline SHA: `04817e98e565f7e0c12f5d1916f96ff87edcbf9e`
- Task HEAD: the Git commit containing this handoff, with subject `ci: freeze YouTube foundation contracts`; its SHA is returned to the controller because a commit cannot embed its own content-derived SHA

## Implemented

- Added the stable `popcorn-process-knowledge-jobs` pg_cron job on `* * * * *`.
- The stored command reads `popcorn_internal_job_url` and
  `popcorn_internal_job_secret` from `vault.decrypted_secrets` on every run,
  validates nonblank values and the exact HTTPS
  `/api/internal/jobs/process` path, and then sends one bounded pg_net JSON POST.
- Missing or invalid Vault values select no rows into `net.http_post`, so clean
  migration application requires no secret and produces no request.
- Added fixture-only GitHub CI with read-only contents permission, Node 20,
  repository-pinned pnpm 11.19.0, a frozen install, `pnpm verify`, the extension
  static gate, clean local Supabase start/reset/pgTAP, vendor shell syntax,
  whitespace validation, and unconditional Supabase teardown without backup.
- Added controller ownership, parallel worktree, review, integration, upstream
  reuse, and GPLv3 isolation policies.
- Added `test:extension` and a directory-scoped CommonJS boundary for the
  existing pinned `extension/tests/release.test.js`; no upstream test was
  copied or rewritten.

## Upstream provenance used

- YouTube Digest: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. This task reuses the
  existing `extension/tests/release.test.js` static cases backed by the Task 1
  intake and preserves `third_party/youtube-digest/LICENSE` and
  `THIRD_PARTY_NOTICES.md`. It adds no copied upstream file or notice.
- Controller resolution recorded in the durable brief: the static script uses
  an anchored name pattern for exactly four compatible release cases (notes
  filter accessibility; runtime credential/model hygiene; retired-file
  absence; prompt-section presence). The two upstream-only package/README
  publishing-copy cases reference files excluded from the frozen intake and
  are not represented as Popcorn coverage.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`, GPLv3, method only. The policy
  permits only immutable raw sources, schema-governed structured knowledge,
  content-addressed result identity, and a persistent recoverable queue.
  No GPLv3 code, tests, prompts, components, assets, naming structure, or
  implementation was copied.
- No dependency or license notice was added.

## Interfaces consumed and produced

- Consumed the reviewed Tasks 1-4 contracts, migrations, RLS, durable
  `knowledge_jobs` lifecycle, pure lease recovery rules, pinned intake, root
  test scripts, and existing extension release test.
- Produced the scheduled recovery hook only. The future internal endpoint,
  worker, bounded lease batch, and all Provider calls remain unimplemented.
- Produced durable controller-only ownership for contracts, migrations,
  generated database types, root configuration/lockfile, vendor intake,
  notices/shared errors, ledger/checkpoints, and final integration.

## Files changed

- `.github/workflows/ci.yml`
- `docs/engineering/agent-boundaries.md`
- `docs/engineering/briefs/foundation/task-5.md` (controller brief committed unchanged after its recorded resolution)
- `docs/engineering/handoffs/foundation/task-5.md`
- `docs/engineering/upstream-reuse-policy.md`
- `extension/tests/package.json`
- `package.json` (scripts only)
- `supabase/migrations/202608160003_cron.sql`
- `tests/provenance/no-llm-wiki-code.test.ts`

No lockfile, dependency, frozen contract, prior migration, generated database
type, extension product source/test, vendor script, notice, ledger, checkpoint,
or Batch file changed.

## TDD evidence

### RED

The provenance test was added before any Task 5 production output:

```text
$ CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
exit 1
Test Files 1 failed (1)
Tests 6 failed (6)
```

All failures were the intended missing outputs: upstream policy (two tests),
agent boundary, Cron migration, CI workflow, and `test:extension` script.

The direct first implementation of the required extension script exposed the
frozen intake mismatch before a passing gate was claimed:

```text
$ CI=true pnpm test:extension
exit 1
ReferenceError: require is not defined in ES module scope
```

Loading the existing file as CommonJS then proved that its first two upstream
publishing-copy cases require non-vendored `extension/package.json` and
`extension/README*.md`. After controller resolution was written to the brief,
the module-boundary/name-pattern assertion was changed before implementation:

```text
$ CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
exit 1
Tests 1 failed | 5 passed (6)
Failure: extension/tests/package.json must exist
```

A final CI regression assertion was added before reordering setup steps:

```text
$ CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
exit 1
Tests 1 failed | 5 passed (6)
Failure: pnpm/action-setup occurred after actions/setup-node cache setup
```

### GREEN

After the minimum outputs and both corrections:

```text
$ CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
exit 0
Test Files 1 passed (1)
Tests 6 passed (6)

$ CI=true pnpm test:extension
exit 0
tests 4; pass 4; fail 0
```

The local Node 24 runner omits name-filtered cases from its totals rather than
reporting them as skipped. The anchored script pattern visibly executes the
four exact cases recorded in the brief and excludes the two documented
upstream-only cases. GitHub CI uses Node 20; no claim is made that the omitted
cases passed.

## Broader verification

Clean local Supabase verification after adding the Cron migration:

```text
$ node_modules/.bin/supabase db reset
exit 0; migrations 001, 002, and 003 applied; deterministic seed loaded

$ node_modules/.bin/supabase test db
exit 0; Files=1, Tests=215; Result: PASS
```

The live local `cron.job` catalog contained one active
`popcorn-process-knowledge-jobs` row with schedule `* * * * *` and the full
Vault-reading command. With neither named secret configured, a read-only check
returned `configured_secrets=0` and `queued_requests=0`.

Fresh final pre-commit output for frozen install, focused provenance,
extension static, full verify, clean reset/pgTAP, vendor syntax, diff, and scope
is recorded immediately before the task commit.

## Contract or migration changes requested

None. Migration 003 is the planned Task 5 output and applies cleanly without
Vault configuration. The controller-owned brief resolution adds only the
test-module boundary file to this task's allowlist and narrows the existing
upstream static gate to cases supported by the already frozen intake.

## Risks and follow-up

- Deployment must create both Vault values; an absent, blank, non-HTTPS, or
  wrong-path value intentionally produces no request and therefore no recovery
  traffic.
- The future Batch B endpoint must authenticate the bearer value, return after
  leasing a bounded user-scoped batch, and never perform Provider work in Cron.
- pg_net necessarily holds request metadata while delivering a POST. Popcorn
  does not copy Vault plaintext into an application table or log it, and the
  migration contains no credential or concrete endpoint.
- The extension static gate deliberately does not claim the two non-vendored
  upstream publishing-copy cases. Later extension tasks remain responsible for
  adapting product-specific manifest/package/release coverage under their
  exact upstream provenance briefs.
