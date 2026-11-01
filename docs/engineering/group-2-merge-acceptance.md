# Group 2 merge independent acceptance — 2026-11-01

## Decision and independence

**Merged Group 2 engineering acceptance: PASS at `f1a739bfdff5ced35fc7626b6a6bca74c7b1df7a`.** Independent fresh full verification and focused merge-boundary checks passed. No confirmed implementation blocker remains in this merge delta. Database, seed, concurrency, extension and production-browser evidence is explicitly inherited from independently accepted `515de296d04c8eb80f0f1a7e3325093f90ae5b9b` after exact-byte comparison and review of the limited intervening business-code changes; those gates were not represented as newly executed at this merge.

This supplement covers integration of Group 2 branch `11fc839` with upstream main `867da0552c17de3ba64adee32f588fad776b86ec`, including main task budgets `de5551c97444e8d827392d9839cc6dcf5444974c` and launcher cleanup. It complements [group-2-acceptance.md](./group-2-acceptance.md), whose original 515de29 verdict, section5.17 matrix, historical live trials and limitations remain unchanged. Controller-authorized retention of upstream main budgets is recorded in [merge-delta.md](./merge-delta.md). This is engineering acceptance, not a new live-model semantic or reliability verdict.

Reviewer `/root/acceptance` did not implement or repair source, prompts, SQL, tests or seed. This reviewer independently reviewed frozen bytes, executed checks, generated private evidence and wrote this report only. No commit, push, PR state transition, real model call or personal database operation was performed. Implementation self-tests were reference material, not the basis for the fresh pass.

## Frozen execution and fresh results

Fresh archive: `/private/tmp/popcorn-group2-merge-acceptance-f1a739b`, created by `git archive f1a739bfdff5ced35fc7626b6a6bca74c7b1df7a` and extraction. Existing `node_modules` was symlinked, and an empty temporary Git repository was initialized solely for provenance ignore checks. No dotenv was copied or loaded from the personal checkout. Node24.13.1, pnpm11.25.0, Next16.3.1.

Commands ran from this archive through the validated test-stack wrapper (project popcorn-phase1-groups24, API54331/DB54332, APP_URL3103). `CI=true` and fixtures were explicit; disabling dependency verification prevents auto-reinstallation through the dependency symlink and does not skip tests. Approved local listener access was used for launcher integration harnesses.

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false verify

python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false exec vitest run tests/integration/model-gateway/structured-json-gateway.test.ts tests/integration/jobs/popcorn-local-runtime.test.ts src/server/domain/round-practice-service.test.ts src/server/ai/prompts/group-2-prompts.test.ts tests/prompt-golden/try-prompts.test.ts
```

| Fresh gate | Result | Evidence |
| --- | --- | --- |
| Complete `pnpm verify` chain | **Exit0** | `/private/tmp/group2-merge-verify-f1a739b.log` |
| Lint / typecheck | Exit0; 0errors, same4 preexisting unused-variable warnings; typecheck clean | Same log |
| Unit | **59files /556 tests PASS** | Same log |
| Contract | **7files /212 tests PASS** | Same log |
| Integration | **29files /555 tests PASS** | Same log |
| Prompt goldens/tool | **3files /48 tests PASS** | Same log |
| Provenance | **2files /16 tests PASS** | Same log |
| Production build | **Exit0**, all25 static pages generated | Same log |
| Focused provider / launcher / round / prompts / tool | **5files /107 tests PASS**, exit0 | `/private/tmp/group2-merge-focused-f1a739b.log` |
| `git diff --check 515de29 f1a739b`; `git diff --check 72cd51f f1a739b`; `git diff --check 867da055 f1a739b` | Each **exit0**, no output | `/private/tmp/group2-merge-byte-evidence-f1a739b.json` |

The full verify chain independently ran **1,387 tests** across100files. The107 focused checks are additional execution of a subset, not107 extra unique tests.

## Merge review

**Upstream preservation: PASS.** SHA-256 and byte comparison of all four complete files against main867da055 confirm no divergence:

| File | SHA-256 of merged bytes |
| --- | --- |
| `src/server/ai/openai-compatible-provider.ts` | `52020fc248fdb3e78942225bdaa4e654daf26ba8836c40d627a225abfdc5873c` |
| `src/server/ai/output-budgets.ts` | `ca6688bbf1cad8e8f5717bc2a66e9ba58228ec24f8396f14d070052215383764` |
| `src/server/ai/structured-json-gateway.ts` | `a462cdc98e49cf5f2bac533b32c5d84a452b8d3f153ca2ac1c5ff1e7ce8ab354` |
| `scripts/popcorn-local.mjs` | `4cbdef62bd172ea4f2ccdb108a65b96759a1738367fc44fb0de9fefbbdd0c1f1` |

**Task budgets and call sites: PASS.** Shared one-time20% headroom gives activation/highlight615, evaluation1844, explanation1229, legacy Saved analysis2458, overview4916 and ceiling9831. Learning-card counts1–5 give2458/4301/6144/7988/9831; translations1/32 give1229/9524. The application gateway accepts up to9831 and rejects9832 before fetch. No second headroom or hidden model minimum was added.

The new production round service uses shared activation615 for v3 and evaluation1844 for both enriched v5 and legacy incomplete-task v4; exported prompt budget constants alias the same definitions. Legacy activation/evaluation, due evaluation, highlighted-card batches, Saved analysis and artifact provider paths consume upstream task budgets. `try-prompts` uses the matching four version budgets and retains exactly one selected trial call; its opt-in/owner validation, proxy rules and explicit nonsemantic fixture reporting remain. Fresh focused assertions cover these paths and include v3 generation failure without publication and v4/v5 selection.

**Exact-model transport boundaries: PASS mechanically.** Only exact `claude-haiku-5-5` receives both `thinking:{type:"disabled"}` and `reasoning_effort:"none"`, for structured and raw text as required by current main. The superseded 515 structured-only switch is absent. Explicit caller max_tokens passes through unchanged. Other Claude names, vendor prefixes, preview/case aliases and unrelated models do not receive those fields. Qwen retains evaluation-version-only `enable_thinking:false`, including v5; activation and translation do not gain it. Tests use mocked responses, including empty reasoning-only envelopes; they prove request/response handling rather than real provider quality.

**Launcher cleanup: PASS.** Signal cleanup stores one pending stop promise and is awaited in command finalization. The independently rerun regression holds cleanup unresolved after startup resolves, checks command has not settled, then releases cleanup and verifies cleanup-before-command ordering. Existing pending-start/ownership/proxy/lifecycle cases also passed. No actual user service was stopped by this check.

**Business invariants and prompt content: PASS for merge delta.** After removing only the new budget import/value substitutions, `activate.v2.ts`, `evaluate.v2.ts`, `round-practice-service.ts` and `try-prompts.ts` compare byte-for-byte with515de29. Evidence: `/private/tmp/group2-merge-business-invariants-f1a739b.json`. Thus task wording/rubric/schema, normalization/coaching rejection, assistance, first-answer/revision/receipt/promotion paths, timeouts, retry policy and no-generic-runtime-fallback decision were not changed by merge integration. Review of the other modified server call sites shows only the same imports and budget substitutions. No group3/4 implementation is accepted by this report.

## Explicit evidence inheritance

The independent comparison enumerates paths at both commits, asserts identical path lists, then compares every file byte. No ignored/missing-file shortcut is used. Counts and path+content manifest hashes are retained in `/private/tmp/group2-merge-byte-evidence-f1a739b.json`:

| Unchanged set, 515de29 → f1a739b | Files | Inherited independent evidence |
| --- | ---: | --- |
| All `supabase/` schema/migrations/SQL fixtures |47| **15 SQL files /840 assertions**, nonempty exact-DML backfill, RLS/owner/negative/replay,022/023 compatibility; `/private/tmp/group2-final-sql-515de29.log` |
| Client UI/API (`src/app`, `features`, `components`, `hooks`) |123| Prior production4browser tests, visual screenshots and UI behavior; fresh unit/contract/integration additionally pass at merged commit |
| Contracts/types/lib/learning-config |11| Unchanged state, validation and business limits; fresh contract212 and full software regression |
| Seed, all `tests/e2e`, Playwright config |9| Two actual seed executions with15-table row equality; both production suites4PASS; `/private/tmp/group2-final-demo-seed-515de29.log`, `/private/tmp/group2-final-e2e-515de29.log` |
| Extension and concurrency script |34| Extension180PASS and both actual dual-connection races; `/private/tmp/group2-final-extension-515de29.log`, `/private/tmp/group2-final-concurrency-515de29.log` |
| Round store, runtime assembly, HTTP wrapper |3| Unchanged SQL fences and production service wiring; full new merged source checks above |

Database/production E2E were not rerun merely to duplicate unchanged evidence. Changed production round and legacy service code was separately proven to differ only in budget wiring and freshly tested. This inheritance covers deterministic state/fixture behavior, not live responses to larger budgets. No database reset or SQL mutation was run during this merge acceptance. For the original full13-row section5.17 mapping and screenshots, see the historical independent report; rows3/6/8 still explicitly exclude future group3 queue/session UI.

## Live-model limits, source exclusions and cleanup

**No live model trial was authorized or performed for this merge.** The original four authorized700-token operations remain historical: original wrong-sense failure, one diagnostic with all700 completion tokens consumed by reasoning, repaired wrong-sense Accuracy1 with explicit meaning feedback, and one failed normal-use contrast. The successful wrong-sense raw optional rewrite still failed its target check; parser/runtime safely discard that optional coaching. Normal-positive availability/quality was not accepted. None of those observations is retrospectively evidence for current1844-token evaluation or two reasoning flags. The upstream configuration may alter outputs/cost, but this reviewer makes no claim it improves real semantics or reliability. Group4's20-question human review remains separate and unperformed here.

The archive excludes the active worktree's generated `next-env.d.ts`, dependency symlink state and newly appearing untracked group3 planning documents. The original checkout's concurrent changes and personal dotenv were not imported. The historical report was not rewritten to imply new gates passed at515.

No temporary production server was started by this merge check. No service-stop command or personal54321/54322 access was performed. Final read-only listener observation found personal3000/PID42640 still running, no3104 listener and no3103 listener at that instant; this reviewer did not stop3103 and does not claim it was running. The dedicated test stack was not stopped. Controller owns any dev-server restart and PR2 ready/merge decision.

Evidence manifest with log sizes and SHA-256: `/private/tmp/group2-merge-evidence-manifest-f1a739b.json`. Main fresh verify log SHA-256: `cfac490e7fe4e445e525547c115cac1fcdd64cfb46655c37b991319e2dd51819`; focused log: `feb0c196783809bbf54fec28647004dd62fff75ab2c4abd7c8720493583a8330`.
