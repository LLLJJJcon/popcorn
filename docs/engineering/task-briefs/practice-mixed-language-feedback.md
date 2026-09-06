# Practice mixed-language feedback repair brief

## Identity

- Plan/task: Delivery recovery — Practice mixed-language `englishFeedback` compatibility repair.
- Baseline commit: `98cd6602a25c277042035b758452615ed61b97d6`.
- Branch: `codex/fix-practice-mixed-feedback`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/popcorn-practice-mixed-feedback`.

## Scope and ownership

Allowed implementation files:

- `src/server/ai/prompts/evaluate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.test.ts`
- `docs/engineering/handoffs/practice-mixed-language-feedback.md`

Forbidden changes include all other files, especially global contracts under `src/contracts/**`, database migrations, generated types, root configuration, lockfiles, Web UI, extension code, routes, persistence, and gateway transport.

## Contract

Consumed interface: model evaluation dimensions containing integer score `1..5` and canonical `englishFeedback` or existing `feedback` alias.

Produced interface: unchanged `PracticeEvaluationWire` and `EvaluationResult`; feedback is normalized to canonical `englishFeedback` and all server-owned pass, assistance, mastery, schedule, identity, and provenance behavior remains unchanged.

Required behavior:

- Each feedback value remains a string, non-blank after trimming, at most 500 characters, and contains at least one ASCII Latin letter.
- Chinese text and Unicode punctuation may appear inside otherwise English feedback so the model can quote or explain the learner's response and target expression.
- Pure-Chinese feedback remains invalid because the product-facing field is still English feedback.
- Existing canonical/alias conflict, missing/non-string feedback, score, and atomic three-dimension rules remain fail-closed.
- Do not modify the global `EnglishTextSchema`.

## TDD evidence

Expected RED: add focused cases proving mixed English/Chinese feedback currently fails at `accuracy.englishFeedback` (and cover the alias path), plus a boundary case proving pure-Chinese feedback is rejected. Capture the failing command/output before implementation.

Expected GREEN: the same focused test passes after the smallest local normalization-schema change, while existing prompt/normalization tests remain green.

Verification commands:

- `pnpm vitest run src/server/ai/prompts/evaluate.v1.test.ts`
- `pnpm eslint src/server/ai/prompts/evaluate.v1.ts src/server/ai/prompts/evaluate.v1.test.ts`
- `git diff --check 98cd6602a25c277042035b758452615ed61b97d6..HEAD`

Do not run full application, browser, database, or live-provider tests for this bounded parser repair.

## Upstream reuse and license

- No upstream code is required.
- Do not copy YouTube Digest or LLM Wiki code, prompts, tests, components, or assets.
- GPLv3 material must remain isolated and absent from this diff.

## Agent handoff

Implement only this brief. Commit the implementation and the handoff report. Return commit SHA(s), RED and GREEN evidence, verification results, residual risks, and the report path.
