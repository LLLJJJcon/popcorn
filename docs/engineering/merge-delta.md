# Group 2 integration with advanced main

Merge inputs: group-2 branch HEAD `11fc839` (independent engineering acceptance frozen at `515de29`) and fetched `origin/main` `867da0552c17de3ba64adee32f588fad776b86ec`. The controller authorized `git merge --no-commit origin/main`; the controller owns the eventual merge commit/push and the next frozen independent acceptance run.

## Authority and historical evidence

Main already contains `de5551c97444e8d827392d9839cc6dcf5444974c`, which introduces task-specific output ceilings with 20% headroom and exact-Haiku reasoning controls. Those changes are **upstream main behavior explicitly retained by the controller**, not an unapproved Group 2 adjustment to the confirmed prompt spec or an attempt to improve a live score. This merge connects the Group 2 call sites that did not exist on main to those same shared budgets. No second headroom calculation or model-specific minimum is added.

The historical `515de29` acceptance report, its 700-token HTTP observations, optional-rewrite failure, normal-positive failure and frozen test counts remain historical evidence for that exact commit. They are not retroactively evidence for the merged budgets/provider. No real trial has been rerun for this merge, and no live-quality or reliability improvement is claimed. Independent acceptance of the merged frozen tree remains a separate controller/reviewer gate.

## Resolved conflicts

| Conflict | Integrated result |
| --- | --- |
| `scripts/try-prompts.ts` | Keep the Group 2 four-version builder and comparison logic, per-version timeouts and one selected trial call; use main's highlight/activation/evaluation constants and per-card analysis budget function. |
| `src/server/ai/openai-compatible-provider.ts` | Preserve main's provider implementation: exact `claude-haiku-5-5` sends both `thinking:{type:"disabled"}` and `reasoning_effort:"none"` for structured and raw-text transport. Remove the superseded Group 2 structured-only gate. Other model aliases/case variants receive neither field; Qwen's evaluation-only `enable_thinking:false` remains unchanged. |
| `tests/integration/model-gateway/structured-json-gateway.test.ts` | Retain both branches' valid regression coverage: explicit caller-budget passthrough, exact-model/alias boundaries, Qwen v5 behavior, empty reasoning-only envelope protection, larger-budget cases and ceiling rejection. Update the old raw-Haiku no-flag expectation to main's two-flag behavior. |

Auto-merged main changes are retained: all existing generation/evaluation/translation/explanation call sites use shared budgets; gateway maximum is the shared application ceiling; learning-card budgets depend on card count; the launcher awaits signal-triggered cleanup before command completion.

Group 2 additions reconciled after the textual merge: `ACTIVATION_MAX_TOKENS` and `EVALUATION_MAX_TOKENS` are aliases of main's constants, both enriched-v5 and legacy-v4 branches in `round-practice-service.ts` use the shared evaluation cap, and active prompt/golden fixture calls use the corresponding current task budgets. Low-level transport tests may still supply explicit arbitrary small budgets to prove passthrough; they are not production task defaults.

## Current shared output ceilings

Source of truth is the unchanged upstream `src/server/ai/output-budgets.ts`:

| Task | Output tokens |
| --- | ---: |
| Highlight expressions | 615 |
| Activate practice, including new v3 rounds | 615 |
| Evaluate practice, v4 and v5 | 1,844 |
| Explain selection | 1,229 |
| Legacy Saved analysis | 2,458 |
| YouTube overview, raw text | 4,916 |
| Learning cards, 1 / 2 / 3 / 4 / 5 cards | 2,458 / 4,301 / 6,144 / 7,988 / 9,831 |
| Translation, 1 / 32 lines | 1,229 / 9,524 |
| Application ceiling | 9,831 |

Budgets exclude input tokens. Existing timeouts, transport/format retry limits, task instructions/rubrics, grading thresholds, assistance rules, rounds, receipts, schedules and no-production-fallback policy do not change. No new model call point, real model call, real retry or personal-database operation occurs in this integration task.

## Self-test evidence

- Before integration fixes, focused tests reproduced **19 failures / 60 passing** across four files: missing unified reasoning controls, old raw behavior and stale Group 2 task caps/trial budgets. Log: `/private/tmp/group2-main-merge-red.log`.
- After wiring fixes, those same four files passed **79/79**. Log: `/private/tmp/group2-main-merge-green-focused.log`.
- Expanded self-test: `python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm --config.verify-deps-before-run=false exec vitest run src tests/integration tests/prompt-golden` → **91 files / 1,159 tests passed**, exit 0. Log: `/private/tmp/group2-main-merge-selftest.log`. This includes the upstream launcher signal-cleanup regression, all prompt/golden checks, round generation + enriched/legacy evaluation budget wiring and both provider transport paths. The first expanded attempt could not bind temporary loopback listeners under restricted tool permissions; the fresh run with local-listener access passed without changing launcher code or model retry policy.
- `pnpm --config.verify-deps-before-run=false exec tsc --noEmit --incremental false` → **exit 0**. Log: `/private/tmp/group2-main-merge-typecheck.log`.
- Scoped ESLint over every changed TypeScript implementation/test/tool path → **exit 0, no diagnostics**. Log: `/private/tmp/group2-main-merge-lint.log`.
- Source-integrity comparison against `origin/main`: `openai-compatible-provider.ts`, `output-budgets.ts`, `structured-json-gateway.ts` and `scripts/popcorn-local.mjs` are byte-identical to the upstream files. Group 2's additional budget consumers retain their accepted business logic and consume those shared definitions.
- These implementer self-tests do not replace the controller's independent frozen-tree gate. No historical 515de29 live-model observation was rerun.

## Protected workspace files

The pre-existing modified `next-env.d.ts` and untracked `node_modules` symlink are excluded from this task and from staging. The Group 3 contract document is untouched. Only the native isolated worktree is used; the original checkout is not accessed or modified.
