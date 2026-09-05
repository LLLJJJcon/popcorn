# Structured Output Reliability — Task 5 Handoff

## Identity

- Plan task: Task 5, Finite Version Compatibility and Zero-Call Cache Reuse.
- Product baseline: `ae0d819`.
- Execution baseline: `26c5eb36856a1e31f8c3392348b8e56a948b8b92`.
- Worktree: `/private/tmp/popcorn-structured-output-task-5`.
- Branch: `codex/structured-output-task-5`.

## Implemented behavior

- Overview, Translation, and Explanation request routes compute compatible result
  keys newest-first from the same validated request payload and gateway
  fingerprint, using the frozen `createJobResultKey` path through
  `createLearningArtifactJobKey`.
- A request-addressable artifact is reused only when its exact owner, source,
  artifact type, null Saved identity, finite prompt version, active model,
  result key, and current strict grounded domain schema agree. A hit returns the
  existing ID/content before job registration, so Provider work is zero-call.
- Unknown/mismatched/malformed historical artifacts are skipped; the normal
  latest-version durable registration remains unchanged. Explicit retry IDs
  remain part of result-key identity and therefore do not silently reuse a
  non-retry artifact.
- Saved candidates accept only exact v1/v2 artifacts. The production query
  filters to this finite list before newest selection, so an unknown newer row
  cannot hide a known readable row.
- Practice activation candidate reads validate Saved v1/v2. Draft readers
  validate Activation v1/v2, and attempt/Due recovery validates Evaluation
  v1/v2/v3. Prompt/model/gateway provenance must be all-null (fixture) or
  all-present with an allowlisted prompt version.
- Practice material accepts strict Saved v1/v2 candidate domain content.
- No persisted or API product shape changed; Saved, Practice, Vault, and
  Progress continue receiving the existing strict domain objects.

## TDD evidence

- Baseline characterization: focused gate had one intentional failure
  (`Practice material` rejected Saved v1), with 254 passing tests.
- Request-addressable RED: new historical cache tests failed because the route
  still registered latest-only work; the first run showed 19 failures / 77
  passes, including existing route fixtures that exposed the newly required
  active-model pin field.
- Saved/Practice RED: 7 expected failures / 130 passes covered Saved v1,
  Practice material v1, candidate/draft/attempt unknown rejection, and Due
  unknown rejection.
- Lookup-order mutation RED: removing newest-first ordering made the dedicated
  test fail 1/1 because v4 was queried before v5.
- Focused GREEN:

  `./node_modules/.bin/vitest --configLoader runner run tests/integration/youtube/learning-artifacts.test.ts tests/integration/jobs/process-jobs.test.ts tests/integration/knowledge/source-traceability.test.ts tests/integration/practice/attempts.test.ts src/server/repositories/practice-material-repository.test.ts src/server/domain/complete-due-practice.test.ts`

  Result: 6 files passed, 277 tests passed, 0 failed.

The direct Vitest binary plus `--configLoader runner` was used because this
isolated worktree temporarily linked the controller's read-only dependency tree;
the default Vite config loader tries to write into that shared tree. No full
suite, real Provider, database, Docker, browser, or network test was run.

## Typecheck differential

`./node_modules/.bin/tsc --noEmit --pretty false` reports exactly the seven
pre-existing TS2741 diagnostics in
`src/features/practice/practice-session.test.tsx` at lines 63, 85, 105, 121,
134, 150, and 162 for missing `savedReturnTarget`. Task 5 adds no diagnostic.

## Upstream and license

- YouTube Digest remains at MIT commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; this server-only change does not
  alter or duplicate transcript reuse.
- LLM Wiki remains method-level inspiration only at GPLv3 commit
  `723e259309aea5e3850265b631f80224f66dd9f6`; no GPL code, test, prompt,
  component, or asset was copied.

## Risks and review focus

- A cache miss may perform two small indexed artifact reads (three for Practice
  Evaluation readers only through existing row reads); this is bounded by the
  frozen finite lists and intentionally avoids a migration/RPC change.
- Review the production Supabase result-key query and active-model comparison,
  newest-first array reversal, retry-ID isolation, and all-null/all-present
  Practice provenance rule.
- `src/server/jobs/process-jobs.ts`, public contracts, prompts, migrations,
  generated database types, UI, root config, dependencies, and lockfile were
  intentionally unchanged.
