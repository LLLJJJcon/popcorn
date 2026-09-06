# Practice mixed-language feedback review repair handoff

## Scope

- Original code baseline: `98cd6602a25c277042035b758452615ed61b97d6`.
- Rejected implementation: `c7faa511c9aa2a1d9cc502023dbdbcddc8b208d8`.
- Repair brief: `docs/engineering/task-briefs/practice-mixed-language-feedback-review-repair.md`.
- Changed only the two Practice feedback contracts, their focused evaluator tests, and this handoff.

## Review finding verified

The rejected implementation widened only the wire normalizer. The final
`parsePracticeEvaluationOutput()` call still passed normalized dimensions through
the global ASCII-only `EvaluationResultSchema`, so valid feedback quoting Chinese
failed after successful wire decoding.

## TDD evidence

### RED

After adding a regression through `parsePracticeEvaluationOutput()`, the focused
test run failed at `EvaluationResultSchema.parse()` with
`Expected Basic Latin/ASCII English prose` for `accuracy.englishFeedback` and
`naturalness.englishFeedback`.

After completing the required boundary tests, the same pre-repair code produced:

```text
Test Files  1 failed (1)
Tests       4 failed | 15 passed (19)
```

The four failures covered canonical final parsing, alias final parsing, direct
domain acceptance of mixed feedback, and the final domain's missing 500-character
limit.

### GREEN

`PracticeFeedbackTextSchema` is now exported from `src/contracts/practice.ts` and
used by both `EvaluationDimensionSchema` and the evaluator wire normalizer. It
requires a string, nonblank content, at most 500 characters, and at least one
ASCII Latin letter while permitting Chinese and Unicode punctuation.

Focused result after the minimal repair:

```text
Test Files  1 passed (1)
Tests       19 passed (19)
```

Coverage includes canonical and alias mixed-language paths through final parsing,
direct final-domain acceptance, and fail-closed behavior for blank, over-limit,
non-string, pure-Chinese, and conflicting canonical/alias feedback.

## Verification

- Focused evaluator Vitest: 19/19 passing.
- ESLint on the three allowed TypeScript files: exit 0.
- Diff whitespace check: exit 0.
- No full suite, database, browser, or live Provider run was performed.

## Interfaces, licensing, and residual risk

- `PracticeEvaluationWire`, `EvaluationResult`, persistence, response shapes,
  score/pass/assistance derivation, coaching, and punctuation normalization are
  unchanged.
- Global `EnglishTextSchema` remains unchanged, so non-Practice English contracts
  retain their ASCII-only behavior.
- Pure-Chinese feedback remains invalid; the deliberately small language check
  only requires at least one ASCII Latin letter and does not classify prose.
- No upstream or GPLv3 code, prompt, test, component, or asset was reused or copied.
- Residual risk is limited to language-quality variance in model feedback; contract
  compatibility for English explanations quoting Chinese is covered by fixed tests.
