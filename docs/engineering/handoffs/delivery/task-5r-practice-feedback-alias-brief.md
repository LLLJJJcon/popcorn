# Delivery Task 5R — Practice evaluation feedback compatibility

- Plan/task: Delivery live-smoke recovery, Task 5R (follow-up to Task 5Q Practice evaluation recovery).
- Controller baseline before brief: `1192da8e5bbe30485c8dc084adf999b5ad4479ec`.
- Implementation worktree: `/private/tmp/popcorn-practice-feedback-alias`.
- Implementation branch: `codex/fix-practice-feedback-alias`.

## Observed failure and required result

The configured OpenAI-compatible gateway is healthy: a minimal request returned HTTP 200. A real, non-persisting evaluation of the current Practice response instead failed parsing because the model returned each score dimension as `{ score, feedback }`, while Popcorn accepts only `{ score, englishFeedback }`.

Make the existing Practice submit flow accept this common provider spelling without weakening the stored `EvaluationResult` contract. The final parsed result must still contain only `score` and `englishFeedback` for `accuracy`, `naturalness`, and `contextualFit`. Existing canonical `englishFeedback` output must remain accepted. Do not change persistence, mastery rules, authentication, gateway configuration, timeout, UI, database, or shared contracts.

## Allowed files

- `src/server/ai/prompts/evaluate.v1.ts`
- One focused test file colocated with that prompt, preferably `src/server/ai/prompts/evaluate.v1.test.ts`
- `docs/engineering/handoffs/delivery/task-5r-practice-feedback-alias-report.md`

All other files are forbidden. In particular, do not modify root configuration, lockfiles, migrations, generated database types, authentication, repositories, routes, UI, or the execution ledger.

## Interfaces

- Consumes: raw JSON returned by `StructuredJsonGateway.complete` for `evaluate-practice-v2`.
- Produces: the unchanged `ParsedPracticeEvaluation` / `EvaluationResult` shape used by Practice persistence.
- Keep trusted `assistanceLevel` behavior and target-expression coaching validation from Task 5Q unchanged.

## TDD evidence required

First add a focused regression test using the real `parsePracticeEvaluationOutput` with all three dimensions spelled `{ score, feedback }`. It must fail because `englishFeedback` is missing. Record the exact RED command/result in the report. Then implement the smallest normalization that maps `feedback` to `englishFeedback` before the existing strict schema parse and removes the alias from the normalized dimension. Record GREEN evidence.

Also cover or preserve canonical `englishFeedback` behavior. Fail closed when neither field is a string; do not coerce arbitrary values. Do not broaden acceptance of unrelated extra keys.

## Verification commands

```bash
pnpm vitest run src/server/ai/prompts/evaluate.v1.test.ts
pnpm eslint src/server/ai/prompts/evaluate.v1.ts src/server/ai/prompts/evaluate.v1.test.ts
pnpm typecheck
git diff --check 1192da8e5bbe30485c8dc084adf999b5ad4479ec..HEAD
```

The focused test must have visible RED then GREEN evidence. Do not call the live Provider and do not expose credentials or raw model output.

## Upstream and license boundary

No upstream reuse is needed for this compatibility fix. Do not copy code, prompts, tests, components, or assets from `nashsu/llm_wiki` (GPLv3). Do not alter the MIT YouTube Digest-derived transcript code. Keep all new code original to Popcorn and compatible with the repository license.

## Handoff

Commit only the allowed files. Write the report path above with: status, commit SHA, RED evidence, GREEN evidence, files changed, scope check, risks, and any concerns. Return only status, SHA, one-line verification summary, report path, and concerns. Do not spawn subagents.
