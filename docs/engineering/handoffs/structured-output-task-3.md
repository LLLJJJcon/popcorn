# Structured Output Reliability — Task 3 Handoff

- Baseline: `4fde3a2da081fe2eaf0ef82e5ce18bb189664485`
- Branch: `codex/structured-output-task-3`
- Worktree: `/private/tmp/popcorn-structured-output-task-3`
- Scope: Saved analysis v2 semantic wire, deterministic evidence grounding,
  explicit-retry identity, owner/type/save-bound candidate status, and
  terminal post-gateway failures only.

## Implemented contract

- `analyze-saved-item-v2` uses the frozen instruction-isolation prefix,
  exactly two newlines, the exact Saved suffix, and no trailing system-message
  newline. The user data contains only `task`, Saved kind/focus text, and
  `{sourceLineIndex, originalChinese}` records. Saved/snapshot/stable IDs,
  hashes, timestamps, ownership, gateway identity, and retry identity never
  enter the prompt.
- The Saved wire normalizer retains only six semantic strings, optional source
  indexes, and confidence. It strips unknown fields, normalizes only allowlisted
  English punctuation, coerces only an unambiguous numeric confidence string,
  defaults omitted confidence to `0.5`, and drops invalid candidates
  independently. Chinese expression bytes are not normalized.
- Grounding maps valid indexes back to persisted source-order segments and
  derives exact `evidenceText`, `segmentIds`, and min/max time. Missing indexes
  recover only when the expression has exactly one exact occurrence in the
  bounded evidence. Unknown, duplicate, ambiguous, or ungrounded references
  are dropped; zero grounded candidates terminates at the safe grounding stage.
- The final stored/public payload remains the existing strict
  `{candidates: CandidateExpression[]}` domain shape.
- POST accepts `{}` or `{retryId: uuid}`. The retry UUID affects only the Saved
  analysis result/dedupe key; it is not included in private job input, model
  input, or artifact content. Reusing one retry UUID remains idempotent while a
  different UUID produces a genuinely new executable job identity.
- Candidate GET consumes `?jobId=<uuid>`. Before returning status, the
  repository validates the authenticated owner, `analyze_saved_item` job type,
  public `saved_item_id`, and the private input's exact `savedItemId`. Public
  results are limited to ready, pending/leased processing, safe terminal
  failure category, or gateway-required; raw error codes and private input do
  not leave the service boundary.
- Saved output/grounding failure, exhausted short transport failure, timeout,
  and persistence failure now transition immediately to `terminal_failed`,
  clear private input, and set `nextAttemptAt` to null. Persistence errors use
  only `INTERNAL:persistence`; exception text is never persisted.
- Published the literal v1/v2 readable-version predicate for Task 5 without
  changing historical artifact lookup or cache reuse.

## RED evidence

Before production changes:

```text
pnpm exec vitest run \
  src/server/ai/prompts/analyze-saved-item.v1.test.ts \
  tests/contract/ai/saved-analysis.test.ts \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/knowledge/source-traceability.test.ts

Test Files  4 failed (4)
Tests       47 failed | 36 passed (83)
Exit        1
```

The failures showed the intended missing behavior: v1 prompt/identity fields,
no semantic normalizer or grounding export, strict rejection of `retryId`,
durable `deferred` retry states, and no bound candidate job-status reader.

## GREEN evidence

Fresh focused verification before commit:

```text
pnpm exec vitest run \
  src/server/ai/prompts/analyze-saved-item.v1.test.ts \
  tests/contract/ai/saved-analysis.test.ts \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/knowledge/source-traceability.test.ts

Test Files  4 passed (4)
Tests       83 passed (83)
Exit        0
```

```text
pnpm typecheck
Exit 2
```

TypeScript reports only the seven accepted baseline TS2741 errors for missing
`savedReturnTarget` in `src/features/practice/practice-session.test.tsx` at
lines 63, 85, 105, 121, 134, 150, and 162. No Task 3 file reports a TypeScript
error, and the unrelated Practice fixture was not modified.

`git diff --check` exits 0.

## Changed files

- `src/server/ai/prompts/analyze-saved-item.v1.ts`
- `src/server/ai/prompts/analyze-saved-item.v1.test.ts`
- `src/server/jobs/job-types.ts`
- `src/server/jobs/handlers/analyze-saved-item.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/domain/confirm-candidate.ts`
- `src/server/repositories/expression-repository.ts`
- `tests/contract/ai/saved-analysis.test.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/knowledge/source-traceability.test.ts`
- `docs/engineering/handoffs/structured-output-task-3.md`

## Consumer-chain impact

```text
assistant text
  -> Task 1 bounded unique-object extraction
  -> Saved v2 semantic candidate normalization
  -> persisted transcript index grounding
  -> unchanged CandidateExpression validation
  -> unchanged generated artifact content
  -> candidate API ready/processing/failed/gateway-required state
  -> Saved cards and later Practice activation consumers
```

No migration, database type, public CandidateExpression schema, Web UI,
extension, Practice behavior, gateway contract, root configuration, or lockfile
changed.

## Residual risks and next-task obligations

- Task 5 must consume `isReadableSavedAnalysisPromptVersion` for finite v1/v2
  historical reads and zero-Provider-call cache reuse. This task deliberately
  generates only v2 and keeps the current reader pinned to the latest version.
- A successful job whose artifact is momentarily unavailable fails closed at
  the candidate status boundary; normal atomic completion should make the
  artifact visible with the succeeded state.
- The seven unrelated Practice fixture type errors remain owned by their UI
  task.
- No real Provider, full suite, build, database reset, Playwright, extension
  test, migration, or upstream source copy was used. No GPLv3 LLM Wiki code,
  test, prompt, component, or asset was copied.
