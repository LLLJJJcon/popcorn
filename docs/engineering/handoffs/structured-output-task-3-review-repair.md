# Structured Output Task 3 — Review Repair Handoff

- Repair baseline: `7277fa4fd0028fdb38c8bebe0b824b72f5204e37`
- Branch: `codex/structured-output-task-3-repair`
- Worktree: `/private/tmp/popcorn-structured-output-task-3-repair`
- Scope: the six findings in
  `docs/engineering/task-briefs/structured-output-task-3-review-repair.md`.

## Repaired contract

1. The Saved system prompt now uses the exact frozen literal
   `[Saved analysis] ` prefix and still has exactly two separator newlines and
   no trailing newline.
2. Candidate job reads validate the supplied owner/type/public-save-bound job
   before returning an already-ready artifact. A terminal or succeeded job may
   use its atomically cleared exact `{}` private input; every nonempty input
   must still pass the full strict input schema and agree on `savedItemId`.
3. Registrar results publish `processing` only for `pending|leased`.
   Existing-job replays are re-read through the owner/type/save-bound
   repository: pending may advance to leased/succeeded/terminal, leased may
   advance to succeeded/terminal, terminal maps to a safe failed category, and
   succeeded requires a strict ready artifact. Regressive, retryable, unknown,
   or unbound replay states fail closed.
4. Every deterministically enriched candidate is independently checked with
   `CandidateExpressionSchema`. A candidate whose evidence exceeds 2,000
   characters is dropped without suppressing another valid candidate.
5. The handler begins in `INTERNAL:persistence` while it reads and validates
   private input and persisted evidence. Only after evidence identity is fully
   validated does it move to transport/model-output/grounding stages.
6. Exact-occurrence recovery advances one code unit after a match, so
   overlapping occurrences count. Omitted indexes for `哈哈` in `哈哈哈` are
   therefore ambiguous and rejected.

The strict persisted/public `CandidateExpression` shape, latest-only Task 3
reader policy, retry identity isolation, and Task 1 gateway/error contracts are
unchanged.

## RED evidence

Each regression was run before its production change:

- Frozen prompt test: 1 failed; received suffix omitted `[Saved analysis] `.
- Job binding/cleared input tests: 2 failed; an unvalidated job returned HTTP
  200 and cleared terminal input returned `null`.
- Registrar replay tests: terminal/succeeded/retryable/unknown cases returned
  contract-invalid HTTP 202 processing states. Follow-up race/status-consistency
  tests also failed before the final bound-status implementation. A fresh
  review then identified unbound pending/leased replay; 3 added regressions
  failed before authoritative replay mapping.
- Independent enriched-candidate test: the 2,001-character candidate raised a
  list-level Zod error instead of preserving the valid candidate.
- Persistence-stage tests: 4 failed; private-input/evidence read or validation
  failures persisted `PROVIDER_OUTPUT_INVALID:grounding` instead of
  `INTERNAL:persistence`.
- Overlap test: expected an ambiguity error, but `哈哈` in `哈哈哈` was accepted.

## GREEN evidence

Fresh combined focused verification:

```text
node_modules/.bin/vitest run \
  src/server/ai/prompts/analyze-saved-item.v1.test.ts \
  tests/contract/ai/saved-analysis.test.ts \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/knowledge/source-traceability.test.ts

Test Files  4 passed (4)
Tests       100 passed (100)
Exit        0
```

The isolated worktree could not use `pnpm exec` because its initial dependency
directory was incomplete and network access was unavailable. Verification used
the exact same lockfile installation from the original Task 3 worktree through
a temporary untracked `node_modules` symlink; the symlink was removed before
commit.

```text
node_modules/.bin/tsc --noEmit
Exit 2
```

TypeScript reports only the seven accepted pre-existing TS2741 Practice
fixture errors for missing `savedReturnTarget` in
`src/features/practice/practice-session.test.tsx` at lines 63, 85, 105, 121,
134, 150, and 162. No changed Task 3 file reports an error.

`git diff --check` exits 0.

## Review

The first fresh read-only review found no Critical or Minor issue and one
Important replay-binding gap: `created:false` pending/leased states were not
re-read. The repair now binds those replays, permits only forward terminal or
success races, preserves the existing `created:false` processing field, and
fails unbound jobs closed. The focused 100-test gate above is after that fix.

## Changed files

- `src/server/ai/prompts/analyze-saved-item.v1.ts`
- `src/server/ai/prompts/analyze-saved-item.v1.test.ts`
- `src/server/domain/confirm-candidate.ts`
- `src/server/jobs/handlers/analyze-saved-item.ts`
- `src/server/jobs/job-types.ts`
- `src/server/repositories/expression-repository.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/knowledge/source-traceability.test.ts`
- `docs/engineering/handoffs/structured-output-task-3-review-repair.md`

No other tracked file changed. The remaining allowed file,
`tests/contract/ai/saved-analysis.test.ts`, needed no edit and remained part of
the focused gate.

## Consumer-chain impact

```text
exact Saved prompt
  -> semantic candidate wire
  -> independently strict deterministic enrichment
  -> unchanged CandidateExpression artifact
  -> owner/type/save-bound job recovery
  -> ready | pending/leased processing | safe failed | gateway-required
  -> Saved cards and later Practice activation
```

## Residual risks and boundaries

- Task 5 historical reader compatibility remains deliberately out of scope;
  this repair validates only the Task 3 latest-version artifact.
- The safe terminal status still depends on the atomic public job row retaining
  its bounded error code while private input is cleared, as frozen by the
  controller-owned database contract.
- No full suite, build, database reset, Playwright, extension test, migration,
  real Provider call, merge, rebase, or push was run.
- No YouTube Digest code changed and no GPLv3 LLM Wiki code, test, prompt,
  component, or asset was copied.
