# Group 4B generation implementation report

Status: pure generation/selection/trial-tool implementation ready for independent acceptance. This is not the group 4 integration gate or the live human-quality gate.

Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`; branch `codex/phase1-group4-confirmed`, authorized after group 3 independent PASS and branch checkpoint `a117eaf`. No commit, push, database mutation, server launch, or real-model call was performed by B4.

## Scope and preflight

- Read repository AGENTS, confirmed specification sections 1/3/4.8/4.9/7/8.0/8.3/8.6/15/16.4, implementation plan, SDD/TDD/verification/test-writing instructions, and local Next server/client isolation guidance.
- Existing `activate.v2.ts` supplies the shared four-field shape and normalized scenario fingerprint. Historical mastery-context hashing is unchanged.
- The controller and A froze the exports below before implementation. A owns shared budgets, contracts, persistence, retries at production call sites, routes, jobs, SQL and integration. C owns the review UI. B did not edit their files.
- Section 4.8 explicitly allows empty modern `usageSettings` and prescribes `casual_chat`; the selector implements that default. It rejects empty/invalid intention metadata and invalid nonempty settings. The caller must establish a modern card; missing legacy metadata is not inferred or classified here.
- The user's latest no-generic-fallback decision overrides the withdrawn template fixture/fallback passages. No withdrawn template content or production fallback was added.

## Files and frozen interfaces

| File | Result |
| --- | --- |
| `src/server/domain/transfer-target.ts` | Exports `TransferDirection`, `TransferTargetInput`, `selectTransferTarget`. Input: mastery, typed card categories/settings, optional/null last actual direction. Result: actual near/far plus complete selected intent/setting metadata. |
| `src/server/ai/prompts/transfer-scenario.v1.ts` | Exact section 8.6 task instruction with existing isolation framing, prompt/version/budget/timeout exports, strict output schema/type, builder, wire/contextual normalizers, validator and deterministic test fixture gateway. |
| `src/server/domain/transfer-target.test.ts` | Tried/reused/owned, alternation/default, primary/secondary intent, distinct alternate setting and invalid modern metadata behavior. |
| `src/server/ai/prompts/transfer-scenario.v1.test.ts` | Isolation/projection, exact instruction, long expression preservation, valid/invalid length/language/output fields, four-field target exclusion, normalized historical dedup and 25 unique synthetic iterations. |
| `tests/prompt-golden/transfer-scenario-v1.json` | Six prescribed review examples and explicit manual expectations. |
| `tests/prompt-golden/transfer-scenario-v1-review.json` | Twenty fixed synthetic **inputs**, covering all ten intentions and five settings. Includes 高得要命/说白了/话虽如此 three times each inside the twenty. These are not generated outputs, a fallback bank or human approvals. |
| `scripts/try-prompts.ts` | New version support, unchanged ordinary raw trial behavior, explicit fixed-review-set mode and complete per-format-attempt audit/report rendering. |
| `tests/prompt-golden/group-four.test.ts` and `try-prompts.test.ts` | Golden/fixture structure, explicit selection, budget, single raw call, four-attempt cap, fixed denominator, transport no-format-retry, invalid/duplicate audit and actual generated-history propagation. |

Prompt exports: `TRANSFER_SCENARIO_PROMPT_VERSION`, `TRANSFER_SCENARIO_MAX_TOKENS`, `TRANSFER_SCENARIO_TIMEOUT_MS`, `TRANSFER_SCENARIO_TASK_INSTRUCTION`, `TransferScenarioOutputSchema`, `TransferScenarioOutput`, `TransferScenarioInput`, `TransferScenarioValidationContext`, `buildTransferScenarioPrompt`, `normalizeTransferScenarioWire`, `createTransferScenarioWireNormalizer`, `validateTransferScenarioOutput`, `createTransferScenarioFixtureGateway`.

`TransferScenarioInput` contains only card expression/meaningHere/useItWhen/toneAndWho, selected targetFunction/targetSetting, actual `near | far`, and all previous situation strings. Builder projection excludes source lines and examples even if surplus properties are present. `previousSituations` maps exactly to activation `avoidSituations` for existing fingerprint validation. Output is exactly situationZh/situationEn/interlocutor/taskEn. The transfer wrapper additionally rejects extra fields and target leakage in interlocutor without changing the accepted activation implementation.

The prompt budget reads A's shared `MODEL_OUTPUT_TOKENS.transferScenario = 400` directly; timeout is 20000 ms. Existing activation/evaluation budgets and scoring rubrics remain unchanged. No hidden retry exists in the pure builder or fixture.

## TDD and verification evidence

1. Initial selector/prompt tests failed because their new modules did not exist.
2. Trial-tool tests then ran against the existing tool and produced seven expected failures: unsupported transfer version, missing review-set functions/selection and absent comparisons. Six fixture/golden cases already passed against the new pure prompt.
3. After implementation, scoped tests initially had 65 passing and one budget failure (`undefined` versus 400). A then added the shared source budget. B's scoped run passed six suites / 92 tests, including accepted group 2 prompt regressions.
4. Final generation-owned test command passed four suites / 52 tests:

   `pnpm exec vitest run src/server/domain/transfer-target.test.ts src/server/ai/prompts/transfer-scenario.v1.test.ts tests/prompt-golden/group-four.test.ts tests/prompt-golden/try-prompts.test.ts`

5. ESLint on all seven generation-owned TypeScript files exited 0. Isolated TypeScript check using `/private/tmp/group4-generation-tsconfig.json` (extends repository settings, includes owned files and installed Node/Vitest types) exited 0. `git diff --check` exited 0.
6. Full project `pnpm test` was attempted; its unit stage reported 660 pass / one failure at `src/features/practice/review-practice.test.tsx:155`, `Review keeps the target out of visible and accessible text before explicit reveal`. C's concurrent UI work was unfinished. Log: `/private/tmp/group4-generation-full-test.log`. B did not change that UI/test to hide the failure.
7. The remaining project stages were run separately and passed: contract 8 suites / 227 tests; integration 30 suites / 562 tests; prompt-golden 4 suites / 63 tests.
8. Whole-project TypeScript initially exited 0 after the pure implementation. A later concurrent test addition temporarily caused `tests/contract/review-practice.test.ts:5` to import the not-yet-created `@/contracts/review-practice`; the final whole-project check was therefore not represented as passing. The B-only check above passed.

No SQL, browser E2E, build, seed changes or production job/GET/regen behavior is claimed by this report. Those are integration/independent acceptance responsibilities.

## Real trial handoff (not executed by B)

Ordinary golden behavior remains one raw structured trial per selected case, without format retries hiding its first invalid output:

```text
pnpm prompts:try -- transfer-scenario-v1 --real --user <approved owner UUID> --case transfer-01
```

Explicit fixed twenty mode:

```text
pnpm prompts:try -- transfer-scenario-v1 --real --user <approved owner UUID> --review-set
```

This mode reuses production `completeWithFormatRetries` with its unchanged default initial + three format retries. It records every format attempt (raw decoded object when available, structural/dedup checks, status; safe stage only for provider failure). Existing provider transport retries remain unchanged. A valid structure ends a case immediately; semantic quality never causes an automatic retry. Four invalid attempts leave a failed empty result in the original denominator of twenty. No twenty-first replacement case, picking a preferred answer or synthetic fallback occurs.

Successful generated situations for the same expression are appended to later cases' actual inputs and recorded in the report, so the required three outputs per example expression are checked against prior generated questions too. Original fixed history remains present. The report includes all twenty rows for human intention/setting, naturalness and approval plus every attempt. Human approval stays pending and requires at least 17/20; mechanical availability is reported separately.

Reports use `docs/engineering/prompt-runs/<UTC date>-transfer-scenario-v1-review-set.md`, append a separately dated run section, and include selected synthetic inputs/outputs only. CLI requires `--real` and an exact UUID before any configuration/network work, resolves the owner's existing approved gateway, never logs configuration/credentials/raw provider errors and never sends personal subtitles or learner responses. `--case` cannot narrow the twenty-case review mode.

## Remaining gates

- A must integrate pure generation with ready-task persistence, complete history, production retry invocation and GET/job/regen fences. C must complete hidden-expression/reveal/revision UI; D independently accepts the integrated group.
- Root/D must execute the authorized real gateway run and obtain the human >=17/20 product review. **B real calls: zero. Human review: pending.**
- The test-only fixture demonstrates deterministic mechanics and unbounded-by-template-pool identities; it establishes no semantic quality or live model reliability.
