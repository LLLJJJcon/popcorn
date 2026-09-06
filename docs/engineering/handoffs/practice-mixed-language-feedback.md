# Practice mixed-language feedback handoff

## Scope

- Baseline: `98cd6602a25c277042035b758452615ed61b97d6`
- Brief commit: `96a8972`
- Branch: `codex/fix-practice-mixed-feedback`
- Changed only the Practice evaluation wire normalizer, its focused tests, and this handoff.

## TDD evidence

### RED

Command:

```text
vitest run --configLoader runner src/server/ai/prompts/evaluate.v1.test.ts
```

Observed before the implementation change:

- 11 tests ran; 2 failed and 9 passed.
- Both new mixed-language cases failed with `{ success: false, fieldPath: "accuracy.englishFeedback" }`.
- The canonical `englishFeedback` and existing `feedback` alias paths therefore reproduced the reported rejection.
- The pure-Chinese boundary test already passed, confirming the failure was specifically the missing mixed-language behavior.

### GREEN

The evaluator now uses a local Practice-only feedback schema. It keeps the existing string, nonblank, 500-character, and at-least-one-ASCII-Latin-letter requirements while allowing Chinese quotations and Unicode punctuation.

Observed after the implementation change:

```text
Test Files  1 passed (1)
Tests       11 passed (11)
```

## Verification

- Focused Vitest: PASS, 11/11.
- ESLint for the two changed TypeScript files: PASS.
- `git diff --check 98cd6602a25c277042035b758452615ed61b97d6`: PASS.
- No live provider, database, browser, or full-suite verification was run, as required by the brief.

## Contract and risk notes

- `PracticeEvaluationWire` and `EvaluationResult` are unchanged.
- Canonical/alias conflict handling, score validation, atomic three-dimension decoding, and optional coaching behavior are unchanged.
- Global `EnglishTextSchema` is unchanged, so transcript translations and other English-only contracts remain strict ASCII English.
- Pure-Chinese Practice feedback remains invalid. The local schema detects English prose by the presence of at least one ASCII Latin letter; it does not attempt language classification beyond that deliberately small contract.
- No upstream or GPLv3 code, prompt, test, component, or asset was copied.
