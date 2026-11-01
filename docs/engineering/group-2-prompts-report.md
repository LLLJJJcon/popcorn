# Group 2 pure prompts and shared fallback content

Owner: Task 2B. Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-groups2-4`. No commits/pushes, backend wiring, migrations, UI changes, real gateway calls or group 4 transfer prompt work by this owner.

## Current delivery

- `activate.v2.ts` exports `activate-practice-v3`, the complete §8.4 instruction verbatim, isolated JSON input with explicitly projected four-field card (no examples), four bounded output fields, task-aware target-exclusion/previous-scenario validators and a separate scenario-deduplication hash. Maximum tokens 400 and timeout 20,000 ms are exported; backend owns the initial call + three format retries.
- `learning-intent-constants.ts` contains all ten intention rules and five setting descriptions from §8.3 verbatim as user-message data. Public helpers `getTargetFunction`/`getTargetSetting` return descriptors with enum value plus label/rule or description; invalid/absent values fall back to other/casual_chat.
- `evaluate.v2.ts` exports `evaluate-practice-v5`. It derives its system text from the unchanged v4 builder and applies only the three approved substitutions: target-meaning scoring scope, requested-act C1 sentence and minimal/full-score-revision suffix. The complete resulting system text is checked against the spec-prescribed transformation. New user JSON is explicitly projected; all-five output suppresses optional revision in both normalizer and final parser.
- Existing v4 normalization remains in use, including English feedback quoting Chinese, canonical/feedback alias handling, integer score strings, optional invalid coaching suppression and program-owned pass/independence decisions. Existing v4 builder/parser behavior is not changed for old tasks.
- Existing `activate.v1.ts` and `evaluate.v1.ts` changes are limited to appending v3/v5 to their finite readable-version arrays. Their system text, builders, rubrics and fixtures are unchanged.
- Golden data: `activate-practice-v3.json` contains the five required cases; `evaluate-practice-v5.json` contains the six required cases. Expected score ranges and semantic reviews are distinct from fixture shape verification.
- `scripts/try-prompts.ts` recognizes both new versions, builds their exact inputs and request budgets, and reports mandatory-field/target-exclusion/repetition/raw-extra-field/score-expectation/full-score-rewrite checks. It retains explicit `--real --user <UUID>` opt-in, one call per selected golden case, existing proxy checks and bounded reports without provider error details. No real runs have been performed. Fixture success is not represented as semantic acceptance.

## Exports for the backend owner

```ts
// learning-intent-constants.ts
type TargetFunction = { value:FunctionCategory; label:string; rule:string };
type TargetSetting = { value:UsageSetting; label:string; description:string };
getTargetFunction(value:unknown):TargetFunction;
getTargetSetting(value:unknown):TargetSetting;

// activate.v2.ts
type ActivationInput = {
  card:{expression:string;meaningHere:string;useItWhen:string;toneAndWho:string};
  targetFunction:TargetFunction;targetSetting:TargetSetting;
  sourceLine:string;avoidSituations:readonly string[];
};
type ActivationOutput = {situationZh:string;situationEn:string;interlocutor:string;taskEn:string};
type ActivationValidationContext = {targetExpression:string;avoidSituations:readonly string[]};
buildActivatePracticePrompt(input:ActivationInput):{systemPrompt:string;userPrompt:string};
normalizeActivationWire:WireNormalizer<ActivationOutput>;
createActivationWireNormalizer(context:ActivationValidationContext):WireNormalizer<ActivationOutput>;
validateActivationOutput(value:unknown,context:ActivationValidationContext):ActivationOutput;
scenarioFingerprint(situationZh:string):string; // not the mastery-context fingerprint
createActivationFixtureGateway():StructuredJsonGateway; // synthetic CI only; never live fallback

// evaluate.v2.ts
type EvaluationInput = {
  targetExpression:string;targetMeaning:string;situationZh:string;interlocutor:string;
  targetSetting:TargetSetting;targetFunction:TargetFunction;taskEn:string;
  toneAndWho:string;watchOut:string|null;learnerResponse:string;
};
buildEvaluatePracticePrompt(input:EvaluationInput):{systemPrompt:string;userPrompt:string};
normalizePracticeEvaluationWire:WireNormalizer<PracticeEvaluationWire>;
parsePracticeEvaluationOutput(value:unknown,targetExpression:string,assistanceLevel:AssistanceLevel);
createEvaluationFixtureGateway():StructuredJsonGateway; // unchanged deterministic semantics
```

The backend writes targetFunction/targetSetting enum values into the agreed task situation metadata and keeps legacy v4 selection for incomplete old task metadata. The client consumes labels/material DTOs rather than importing these server modules.

## Test evidence so far

- RED: new pure-module suite failed resolving nonexistent new modules; after implementation, 21/21 tests passed. These cover exact instruction/rubric text, isolated inputs, all constants, four length limits including astral code points, invalid mandatory fields, target leakage, duplicate scenarios, aliases, program decisions, optional coaching and evaluation fixture validity.
- RED: updated readable-version test failed because v3/v5 were absent; GREEN: old + new pure suites 40/40 passed. Existing frozen v4 text assertions still pass.
- RED: golden suite failed resolving absent datasets; after data, four behavioral tests failed on old trial-tool versions/comparisons; GREEN: golden and trial tooling suites 21/21 passed.
- `pnpm --config.verify-deps-before-run=false exec vitest run src/server/ai/prompts tests/prompt-golden` → **9 files, 108 tests passed** before the synthetic activation CI gateway was added.
- First whole-worktree typecheck found two optional-property accesses in this owner's golden tests; these were fixed. The next run reported only concurrent UI test errors in `src/features/practice/practice-session.test.tsx`; those files were not changed by this owner. This is not a claim that the final whole group typecheck passes.
- Scoped lint initially found one unused destructured optional-revision variable; replaced with explicit dimension projection. Final lint/test evidence will be appended after the content-dependent work.
- Fresh pre-approval rerun: the same scoped prompt/golden command passes **9 files / 108 tests** after the optional-property and unused-variable cleanup. Scoped ESLint over all six new/modified implementation/test/tool files exits 0 with no warnings.

## Withdrawn product fallback and explicit CI fixture override

Draft: `docs/engineering/fallback-situations-review.md`; product-readable presentation is maintained by the controller in `fallback-situations-product-review.md`. Canonical JSON SHA-256: `81ef89bf794e029f7ea8438b8ca5cfd415ae2126344fce42e3a7929cc83c3784` (JSON.stringify, UTF-8, no trailing newline). All twenty entries passed the four mechanical length limits; exactly two entries exist for each of the ten intentions.

The user **withdrew these templates** after identifying that intention alone cannot guarantee compatibility with an expression's specific meaning, original form or suitable setting (for example, 高得要命 does not fit cold takeaway or an unsuccessful repair visit). No content from this draft is used in runtime, fixtures or seed data; its canonical JSON remains unchanged. No `fallback-situations.ts` or runtime selector is introduced.

The final confirmed product behavior supersedes §8.7 and the earlier four-failures-then-template decision: cancel generic runtime fallbacks in first practice and due reviews; retain already prepared tasks; if no task is available, report preparation failure with Try again while preserving state. Failed regeneration retains the existing task without consuming the successful-regeneration allowance. No expression-specific question bank is added. Backend owners implement this behavior; this task does not change their integration files.

Because §8.4's fixture originally depended on the withdrawn §8.7 templates, the user explicitly approved a separate **test-only deterministic gateway**. `createActivationFixtureGateway()` now synthesizes bounded CI exchanges from input setting/intention and an unused numbered test identity. It validates target exclusion and scenario uniqueness using the same task-aware normalizer; the N supplied previous situations can occupy at most N of N+1 generated identities, so tests are not restricted to two rounds. It reads no product templates and is selected only through the existing CI fixture-provider mode. Its generic output proves shape, persistence and lifecycle wiring only: it is not a live fallback, a semantic-quality claim or an approved question bank. No model call occurs in this gateway.

This content gate is separate from group 4's twenty **real generated** questions and human acceptance review. No synthetic/fixture output satisfies that later gate.

## Final Task 2B verification

- Fixture RED: two new tests failed because `createActivationFixtureGateway` was not exported. GREEN: deterministic replay, subsequent distinct round and twelve-round history tests pass after the synthetic provider was added. Every activation golden input also passes that provider's task-aware normalizer; these are structural/lifecycle tests, not semantic scoring acceptance.
- Fresh `pnpm --config.verify-deps-before-run=false exec vitest run src/server/ai/prompts tests/prompt-golden` → **9 files, 110 tests passed**.
- Fresh scoped ESLint over `activate.v2.ts`, `evaluate.v2.ts`, `learning-intent-constants.ts`, `group-2-prompts.test.ts`, `group-two.test.ts` and `scripts/try-prompts.ts` → **exit 0, no warnings**.
- Fresh whole-worktree `pnpm --config.verify-deps-before-run=false exec tsc --noEmit --incremental false` → **exit 0**. Earlier concurrent UI errors were no longer present at this check; final group verification remains the controller/independent reviewer's gate.
- Recomputed SHA-256 of the withdrawn twenty-entry canonical JSON remains `81ef89bf794e029f7ea8438b8ca5cfd415ae2126344fce42e3a7929cc83c3784`; status/proposal text changed, JSON content did not.
- No real model calls, runtime fallback data/selector, group 4 transfer prompt, seed or backend/UI/SQL edits were performed by Task 2B. All generated test scenes remain explicitly synthetic CI data.
