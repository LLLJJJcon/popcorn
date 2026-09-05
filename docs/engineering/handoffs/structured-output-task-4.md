# Structured Output Reliability — Task 4 Handoff

- Baseline: `7c935753280786cbf9697feea0ea9eb4369a5a25` plus the controller's
  Wave 1 brief commit `4fde3a2da081fe2eaf0ef82e5ce18bb189664485`
- Branch: `codex/structured-output-task-4`
- Worktree: `/private/tmp/popcorn-structured-output-task-4`
- Scope: Practice activation v2 and evaluation v3 prompt, wire,
  normalization, server enrichment, and deterministic decision behavior only.

## Implemented contract

- Activation now generates only `activate-practice-v2`, sends the frozen
  instruction-isolation system prompt separately from untrusted candidate
  data, and accepts only the semantic `promptChinese` wire field. The wire
  normalizer strips unknown fields, requires 1–160 Chinese characters ending
  in `?` or `？`, and the domain service rejects a prompt containing the target
  expression.
- The activation service derives the selected expression and all identity and
  provenance from validated server state. It supplies the frozen product copy
  `Reply with one natural Simplified Chinese sentence.` and
  `Use the target expression naturally in this new situation.` rather than
  trusting model echoes.
- Evaluation now generates only `evaluate-practice-v3`. Its system prompt is
  exactly the frozen prefix, suffix, and all 15 rubric anchors using the
  controller-frozen separators. Its user payload contains only
  `task`, `targetExpression`, `promptChinese`, and `learnerResponse`.
- One shared evaluation normalizer accepts the bounded `feedback` alias,
  unambiguous integer strings, documented English smart punctuation, unknown
  non-conflicting fields, and shared prose/wrapper extraction. All three score
  dimensions remain mandatory and atomic. Invalid optional Chinese coaching
  is discarded without losing valid scores.
- `derivePracticeDecision` is the sole new decision rule:
  `passed` requires all three scores to be at least 3, and `independentUse`
  additionally requires server-owned assistance level `none`. Original,
  revision, and Due services call it before persistence/scheduling and ignore
  model-supplied decision or assistance fields.
- Published finite readable-version predicates cover activation v1/v2 and
  evaluation v1/v2/v3 for Task 5. This task intentionally does not change any
  historical repository lookup or dedupe seam.

Persisted `PracticeTaskSchema`, `EvaluationResultSchema`, database columns,
mastery transitions, and schedules remain unchanged.

## RED evidence

The isolated worktree initially lacked a complete dependency link and network
access was unavailable. Tests therefore used a read-only symlink to Task 1's
already installed `node_modules`; no dependency, config, or lockfile changed.

```text
./node_modules/.bin/vitest run \
  src/server/ai/prompts/evaluate.v1.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/server/domain/complete-due-practice.test.ts

Test Files  3 failed (3)
Tests       31 failed | 40 passed (71)
Exit        1
```

Failures showed the old versions and combined prompts, activation requiring
model echoes, absent v2/v3 readable predicates and shared decision function,
no tolerant evaluation wire normalizer, model-controlled `passed`, and Due
promotion despite a score of 2.

After the controller froze the prompt separators, the exact evaluation-system
string test was changed first and observed failing because rubric rows still
had blank lines between them. The builder was then changed to one newline
between rubric rows and no trailing newline.

## GREEN evidence

Fresh focused verification:

```text
./node_modules/.bin/vitest run \
  src/server/ai/prompts/evaluate.v1.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/server/domain/complete-due-practice.test.ts

Test Files  3 passed (3)
Tests       71 passed (71)
Exit        0
```

The direct equivalent of `pnpm typecheck` was also run:

```text
./node_modules/.bin/tsc --noEmit --pretty false
Exit 2
```

It reports exactly the seven allowed pre-existing `savedReturnTarget` TS2741
errors in `src/features/practice/practice-session.test.tsx` at lines 63, 85,
105, 121, 134, 150, and 162. No new diagnostic names a Task 4 file.

`git diff --check` exits `0`.

## Changed files

- `src/server/ai/prompts/activate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.test.ts`
- `src/server/domain/create-practice-task.ts`
- `src/server/repositories/attempt-repository.ts`
- `src/server/domain/complete-due-practice.ts`
- `src/server/domain/complete-due-practice.test.ts`
- `tests/integration/practice/attempts.test.ts`
- `docs/engineering/handoffs/structured-output-task-4.md`

No migration, contract, root config, lockfile, other model operation, Saved or
Practice Web UI, extension, or user-local file changed.

## Consumer-chain impact

Activation assistant text now becomes one normalized prompt, then server-owned
candidate identity and fixed English copy, then the unchanged strict Practice
task record. Evaluation assistant text becomes one normalized three-dimension
wire value, then a deterministic decision using actual interaction assistance,
then the unchanged attempt record. Original, revision, and Due therefore
persist and expose the same domain fields as before; Vault promotion, mastery,
and schedule consumers receive corrected server-owned decisions without a
schema change. A valid non-pass remains a recorded learning result rather than
a Provider failure.

## Residual risks and next-task obligations

- Task 5 must wire the exported finite readable-version predicates into
  historical artifact/repository reuse. No historical-read behavior was added
  here by design.
- Simplified-Chinese validation continues to use the existing repository
  `TargetChineseTextSchema` Han-text boundary; this task does not introduce a
  new script-conversion dependency.
- Repository-wide typecheck remains nonzero only for the seven explicitly
  allowed pre-existing Practice UI fixture diagnostics, owned outside Task 4.
- No upstream source was copied. No extension code or YouTube Digest pin was
  touched, and no GPLv3 LLM Wiki code, test, prompt, component, or asset was
  reused.
