# Group 4 independent acceptance

Date: 2026-11-01. Independent reviewer/tester: acceptance agent D, separate from backend/domain/UI/demo implementers A/B/C/controller.

**Engineering conclusion: PASS for the confirmed modern Review path and compatibility with already-prepared legacy questions. Product acceptance remains PENDING.** There are no unresolved engineering blockers in the frozen source. The required legacy policy choice and the human assessment of twenty actual modern questions have not been approved. This report does not authorize merging main or claim that all of group4 is product-approved.

## Frozen source and independence

- Final source: `4591f0a9b690d8d715be087c4ccc5fe5972b14c0`, branch `codex/phase1-group4-confirmed`.
- Group3 accepted baseline: `0f7feff44ed4c54280c1c3c9d571639454869aae`.
- Backend/SQL/seed acceptance source: `41a63271dc3c23146f665a7d5b0af3478785e21e`.
- Fresh `git archive` copies: `/private/tmp/popcorn-group4-acceptance-41a6327` and `/private/tmp/popcorn-group4-acceptance-4591f0a`. Each has its own temporary Git provenance snapshot and a symlink to the existing dependencies. No dotenv was copied. Build/output files were created only in the final archive.
- Exact-byte inheritance was independently verified with `git diff --name-only 41a6327 4591f0a -- src/server src/app/api src/contracts src/types supabase scripts/seed-demo.ts tests/fixtures/demo tests/contract/review-practice-concurrency.py tests/contract/review-official-replay.ts tests/contract/practice-promotion-concurrency.sh`: empty output, exit0. Evidence: `/private/tmp/group4-d-inheritance.json`. Backend, SQL, races and seed evidence below was run on41, not rerun or relabelled as a fresh4591 execution. Extension files are also unchanged.
- D reviewed code and ran independent verification; D did not implement or alter product source, prompts, migrations, tests, fixture expectations or seed code. Private launchers/drivers only select the isolated environment, frozen imports and output locations. D did not commit/push.
- The original checkout's unrelated concurrent changes, personal dotenv, personal model configuration and learning data were excluded. The controller's generated `next-env.d.ts` and dependency symlink were excluded from the implementation snapshot.

## Safety and environment

Node `v24.13.1`, pnpm `11.25.0`, Next `16.3.1`. Database tests use only project `popcorn-phase1-groups24`, API54331 / DB54332, through `/private/tmp/popcorn-phase1-test-stack/with-test-stack.py`. Supabase CLI always specifies `--workdir /private/tmp/popcorn-phase1-test-stack --local`. No database reset or migration reapplication was performed. Credentials stay in child process environment; none is included in this report or database connection arguments of the private launchers.

The final production application ran with `CI=true`, `POPCORN_PROVIDER_MODE=fixtures`, APP_URL/baseURL `http://127.0.0.1:3104`. Browser fixtures are reserved52/53/55 accounts; races use guarded597 accounts and the existing guarded promotion fixture. They were removed after tests. A separate exact-email57 demo was retained for review. Personal ports3000/54321/54322 and controller3103 were preserved.

## Independently executed gates

All successful rows below exited0. Paths are private evidence retained locally, not assertions based on implementer reports.

| Gate / source | Command | Observed result | Evidence |
| --- | --- | --- | --- |
| Complete verify /4591 | `python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false verify` from the final archive | Lint0 errors /4 existing warnings; typecheck0; unit78 files/831 tests; contract9/232; integration32/578; golden4/63; **1704 application tests**; provenance2/16; clean production build55 routes | `/private/tmp/group4-d-verify-4591f0a.log` SHA256 `1902de74b005b7c237fadc2cc4f08dacbe62a82360ef807ba18c78616388f1a0` |
| Backend focused /41 | Guarded fixture `pnpm exec vitest run` for completion, revision, Review/HTTP, actual repository, preparation worker, job wiring/process, material repository and Review contract (10 files) | **238/238 PASS**; includes official graph/provenance/offset-time negatives and the repaired snapshot test | `/private/tmp/group4-d-backend-focused-41a6327.log` |
| Extension /41, unchanged in4591 | `pnpm --config.verify-deps-before-run=false test:extension` | **180/180**, no skip/cancel | `/private/tmp/group4-d-extension-41a6327.log` |
| Provenance /41 | `CI=true pnpm --config.verify-deps-before-run=false test:provenance` | **16/16**; also freshly passed inside final verify | `/private/tmp/group4-d-provenance-41a6327.log` |
| All SQL /41 | `python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py node_modules/.bin/supabase test db --workdir /private/tmp/popcorn-phase1-test-stack --local /private/tmp/popcorn-group4-acceptance-41a6327/supabase/tests/*.sql` | **22 files /1094 assertions PASS**, transaction rollback suites, including existing group1–3 SQL and new Review/RLS/history/revision/outbox/completion cases | `/private/tmp/group4-d-sql-41a6327.log` |
| Real Review concurrency /41 | `python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py python3 tests/contract/review-practice-concurrency.py` | **4 actual two-connection row-lock races PASS**; each confirms the losing connection really waits. Then actual source-deleted repository/coordinator replay: **0 gateway lookups,0 model calls**, attempts/mastery events/canonical expressions/reviews deeply unchanged;597 fixtures cleaned | `/private/tmp/group4-d-concurrency-41a6327.log` |
| Prior promotion races /41 | Guarded wrapper runs `/private/tmp/group4-d-old-races.py`, invoking unchanged `tests/contract/practice-promotion-concurrency.sh` via private PG-environment adapter | **2 real races PASS**: duplicate promotion and same-candidate cross-round promotion; exact reserved fixture absent afterward | `/private/tmp/group4-d-old-races-41a6327.log` |
| Real demo twice /41 | Guarded fixture `node --import tsx /private/tmp/group4-d-drivers/group4-demo-41a6327.mts`; all3 source imports bind the frozen archive | New reserved57 / exact email `group4-demo-d-acceptance@popcorn.test`; referenceNow7 days earlier, then+1 day; **15 tables row-for-row identical**, same IDs,2 archive rows unchanged,2 real-published modern near/far prepared questions, version1/unconsumed regeneration; queue **2 Review/1 Second try/3 New/12 minutes**. No real model | `/private/tmp/group4-d-seed-41a6327.log`; snapshot SHA256 `38c45a13fdb5f078e0f5ac2c6b39f13879956b0e15f236444a8af894d2b235f1` |
| Production browser /4591 | Guarded `/private/tmp/group4-d-drivers/launch-final.py node node_modules/@playwright/test/cli.js test --config /private/tmp/group4-d-drivers/playwright-4591f0a.config.ts --project chromium-web` against the fresh final build | **5/5 PASS (1.4m)**, one worker, both required suites; final completed-notice absence assertions actually ran | `/private/tmp/group4-d-e2e-4591f0a.log`; output `/private/tmp/group4-d-e2e-4591f0a-output/` |
| Natural due far smoke /4591 | Guarded fixture `node --import tsx /private/tmp/group4-d-drivers/far-smoke-4591f0a.mts` | Prepared modern far/Suggest/Work&school GET200; due time naturally `2026-10-31T00:05:00+00:00`; one main/H1, correct mask/About/EN; **1 browser Review GET,0 browser practice mutations**, six public learning/archive tables deeply unchanged | `/private/tmp/group4-d-far-4591f0a.log`, `.json`, `.png` |
| Full group4 patch format | `git diff --check 0f7feff..4591f0a` | PASS, exit0 | Independently executed from active repository |

The first private verify launch accidentally used `/private/tmp` as cwd and exited1 before any product command because no package manifest existed there. Evidence `/private/tmp/group4-d-verify-launch-cwd.log` is retained. The corrected final-archive launch above passed fully; no product change, test omission or weakened assertion was used. Existing lint warnings are unused variables/imports in the prior lease/attempt/source-traceability code.

## §7.9 nine-item matrix

The original generic fallback requirement is superseded by the user's explicit no-generic-runtime-fallback decision. Failed cold generation retains state and offers explicit retry; failed regeneration preserves the original question, draft and successful-regeneration allowance. Prepared questions remain usable without a gateway. This approved override is evaluated below rather than silently reviving withdrawn templates.

| # | Requirement | Engineering evidence / result | Product or semantic gate |
| --- | --- | --- | --- |
|1|Three intents,3 distinct questions each; tried near/reused far; no target wording|**Mechanical PASS**: fixed actual20 contains the three required expressions with3 distinct normalized questions each; approved transfer direction/target/history/normalizer tests and63 golden tests pass. Exact prompt,400 tokens,20seconds and max4 format attempts are preserved.|Human intent/setting/naturalness judgment remains part of#2; mechanical success is not semantic approval.|
|2|Human review20 questions,>=85%|Actual modern20 retained unedited;20/20 structural checks,20 logical cases/20 HTTP requests/one format attempt per case were observed in the earlier authorized trial.|**REQUIRED PENDING:0 human judgments filled; no17/20 approval.**|
|3|Prepared read0 model calls; failure behavior|**PASS under approved override**: ready GET precedes gateway/claim; failed cycles do not reopen through plain GET, late worker or new job ID. Domain/SQL/outbox tests pass; prepared browser view works with setup banner and no mutation. No runtime generic fallback exists.|New legacy-generation policy remains REQUIRED PENDING; already-prepared legacy reading/v4 scoring is preserved.|
|4|Default mask/About mask; reveal is unassisted and durable|**PASS**: pure visible/aria/persistence regressions, actual masked screenshot and far smoke; real browser reveal-only completion stays independent; examples persist assistance separately.|No unapproved behavior added.|
|5|One successful replacement, none after submission, independent use retained|**PASS**: same-ID unknown network retry, one success, version2 refresh, original winning replay and losing-waiter guards; SQL/row-lock races fence both completion/regeneration orders. Failed replacement retains old state.|No semantic retry or allowance expansion.|
|6|Learning revisions compare answers without changing official result/mastery/schedule|**PASS**: real production first/latest restore, scored revision, original first receipt replay and immutable official graph assertions; RLS/claim/cache/owner SQL and pure tests pass.|No revision contributes official Progress evidence.|
|7|Natural-version side-by-side character differences, no model on disclosure|**PASS**: shared comparison unit tests and real due browser expanded comparison with visible `mark`; first-practice regression suite also passes.|Optional invalid/targetless rewrite is safely discarded; all-five coaching null remains tested.|
|8|Result wording and local dates|**PASS**: independent-success and examples-assisted production results, original first result retained after late examples/revision, existing local-date tests; final pre-answer warning is absent once official first exists (two final browser assertions).|Fixture score/result correctness is engineering evidence, not a real-model quality verdict.|
|9|Updated completion/domain/SQL/UI tests|**PASS**: final1704+16, full1094 SQL,238 focused,180 extension,6 real races,5 production browser cases and actual seed replay above.|Full group4 product completion still waits for#2 and legacy decision.|

## Previously identified findings and independent repair checks

- Unknown prepare/regenerate publication cannot invent terminal failure: fail writes are fenced and their boolean result is observed; ready/pending/failed receipt recovery preserves the same request ID when unresolved. The coordinator's unknown official publication checks the receipt before attempting failure. Confirmed-unknown and commit-response-loss pure cases pass.
- Retry proof validates every supplied Origin/Referer/Sec-Fetch proof; contradictory/malformed proofs fail even if another proof matches. Targeted HTTP tests passed again in frozen backend verification.
- Regeneration waiters cannot adopt a winner's successful ready state; the exact winning UUID replays even after official completion. Lifecycle SQL and both actual lock orders pass.
- Version identity and scored full question text now come from the same prepared snapshot; the earlier existing repository RED case passes independently. Modern context cannot silently downgrade to legacy scoring.
- Source-free replay no longer requires live display material. The new path restores the prior owner/task/snapshot/provenance, unique event, event time, legal transition, current mastery rank and schedule validations. The seven negative graph/provenance cases and PostgreSQL offset-time regression passed; actual post-source-deletion replay showed0 gateway/model and deep official graph equality. No-new-operation historical replay is additionally covered by the coordinator's source-unavailable test; this does not introduce new generation/display rights for deleted sources.
- Complete UUIDs claim before scoring; same-ID overlap shares one claimed cycle, known format exhaustion remains cached at4 attempts, new explicit retry is distinct, and unknown outcomes retain the old ID. Atomic publication re-derives assistance from the latest server marker. Later examples do not alter the immutable first result.
- Preparation outbox is in the scheduling transaction, uses a real owned source and private Review input, and has one durable preparation execution. Worker/GET share the same persisted cycle; late job IDs are not user retries. Owner/attempt/lease finish fences and source-deletion operational-FK cleanup pass. Other job retries retain their original policy.
- All group3 regressions remained in final verify: finished/new-Start boundary and Undo restoration; late child/current-item guards; other-tab promotion recovery without fabricated Added evidence; real404/FORBIDDEN and409/CONFLICT Review queue confirmation, retaining answer on503/still-eligible errors. The production six-item session additionally exercised native Exit/resume, refresh, round-in-place, Remove/Undo, finish and summary.

## Browser visual review

D opened and inspected these actual final-production captures:

- `/private/tmp/group4-d-e2e-4591f0a-output/returning-learner-returnin-e7064-out-increasing-saved-volume-chromium-web/group4-review-masked.png`: blocks, meaning, mastery, interlocutor, task and controls readable; target hidden.
- Same directory `group4-review-revision.png`: first/revision comparison, score change, first feedback, immutable success/date, and no misleading pre-answer warning after completion.
- `/private/tmp/group4-d-e2e-4591f0a-output/saved-learning-loop-saved--06a77--knowledge-and-due-Practice-chromium-web/group4-review-assisted.png`: assisted result and session Finish/Revise controls; completed warning absent.
- `/private/tmp/group4-d-far-4591f0a.png`: actual due far modern prepared task, masked expression, About and EN view readable.

The fixture gateway deliberately produces synthetic test situations. Their screenshots are UI/engineering evidence, not examples offered for the twenty-question human quality decision.

## Required product decisions and preserved actual outputs

The earlier independent authorized modern benchmark was run from pure/tool checkpoint `c1322a9f570abd8588202dd2fb4a437f037afb20`. Its approved resolved and requested model was observed as `claude-haiku-5-5`, revision3, approved AiHubMix origin, fixture mode false. The observer asserted request model, both configured thinking flags,400 tokens and frozen prompt/input. Provider response `model` was not captured, so configuration/request observation is not proof of the underlying model identity.20 logical inputs produced20 HTTP200/stop responses, one attempt each, with all mechanical checks passing. No extra real model call was made during this final engineering acceptance.

These hashes remain unchanged:

| Preserved artifact | SHA256 / state |
| --- | --- |
| `docs/engineering/group-4-legacy-decision.md` | `fb575beb7647c65d571833d5c4d3f5154cfb43b4b7299ff13c379053b346a0b2`; A/B/C choice unanswered; no newly authored legacy prompt implemented/called |
| `docs/engineering/review-situations-product-review.md` | `c12205d7bba3e9b2a1ab97d91609d2d3f3de73c4ff0f95551e0a9bb68ed93bc1`; actual modern output, human fields pending |
| `docs/engineering/prompt-runs/2026-11-01-transfer-scenario-v1-review-set.md` | `f5d122184fba34a865dbf6f992c688f8cb319e97631a53bb79f1ef6db31c29e8`; original CLI input/output/attempt report unchanged |

The withdrawn generic20 draft was not used as fallback, actual output or approval. CI fixtures were not represented as real semantic quality. The previously recorded group2 real-model limitations are not retroactively approved by these group4 structural results.

## Cleanup and delivery boundary

The temporary production listener was verified by port3104 and exact cwd `/private/tmp/popcorn-group4-acceptance-4591f0a`, then PID16033 was terminated. Port3104 is closed. Before/after PID checks show personal3000(PID42640), controller3103(PID43691) and all local database listener PIDs unchanged. Evidence: `/private/tmp/group4-d-service-cleanup.json`. The dedicated stack and reserved57 demo remain available. Exact temporary E2E/race fixture accounts are absent (`/private/tmp/group4-d-fixture-cleanup.log`).

The final engineer-approved source is4591. This documentation is an independent acceptance artifact for the controller to commit and include in the group4 PR. PR readiness/merge must retain the two required pending product gates; this report does not mark them approved or claim the overall user task completed.
