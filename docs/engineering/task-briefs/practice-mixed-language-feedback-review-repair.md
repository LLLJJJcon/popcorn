# Practice mixed-language feedback review repair brief

## Identity

- Original code baseline: `98cd6602a25c277042035b758452615ed61b97d6`.
- Rejected implementation HEAD: `c7faa511c9aa2a1d9cc502023dbdbcddc8b208d8`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/popcorn-practice-mixed-feedback`.
- Review result: FAIL because `parsePracticeEvaluationOutput()` revalidates mixed feedback through the ASCII-only `EvaluationResultSchema`.

## Allowed files

- `src/contracts/practice.ts`
- `src/server/ai/prompts/evaluate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.test.ts`
- `docs/engineering/handoffs/practice-mixed-language-feedback-review-repair.md`

All other files are forbidden. Do not change the global `EnglishTextSchema`, database, generated types, routes, persistence, UI, root configuration, or lockfile.

## Required repair

- Add and export one Practice-specific feedback schema in `src/contracts/practice.ts`.
- The schema must require a string, nonblank content, no more than 500 characters, and at least one ASCII Latin letter; it may contain Chinese and Unicode punctuation.
- Use this same schema in both `EvaluationDimensionSchema` and the wire normalizer so the model boundary and final domain contract cannot disagree.
- Preserve canonical `englishFeedback`, the existing `feedback` alias, normalized punctuation, strict dimension object output, scores, pass/assistance derivation, coaching, persistence, and response shapes.
- Pure-Chinese feedback must remain invalid.

## TDD and verification

Before implementation, add a test through `parsePracticeEvaluationOutput()` that fails on the current rejected HEAD. Then implement the smallest repair.

Focused coverage must prove:

- canonical and alias mixed English/Chinese feedback reach the final parsed `EvaluationResult`;
- the exported final domain schema accepts valid mixed feedback;
- blank, over-500-character, non-string, pure-Chinese, and conflicting canonical/alias feedback fail closed;
- the existing normalization/prompt/decision cases remain green.

Run only:

- `pnpm vitest run src/server/ai/prompts/evaluate.v1.test.ts`
- `pnpm eslint src/contracts/practice.ts src/server/ai/prompts/evaluate.v1.ts src/server/ai/prompts/evaluate.v1.test.ts`
- `git diff --check 98cd6602a25c277042035b758452615ed61b97d6..HEAD`

No full suite, database, browser, or live Provider run is required.

## Interfaces and licensing

- Public data shape is unchanged; only accepted feedback character content is widened for Practice.
- No upstream reuse is needed. Do not copy YouTube Digest or LLM Wiki material. GPLv3 content must remain absent.

Commit the repair and handoff report. Return the repair commit SHA, RED/GREEN evidence, focused checks, residual risk, and report path.
