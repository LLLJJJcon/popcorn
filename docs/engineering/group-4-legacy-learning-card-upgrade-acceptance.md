# Independent acceptance — source-grounded legacy learning-card upgrade

2026-11-02, Asia/Shanghai. Independent acceptance agent D.

**Engineering verdict: PASS for source `12569275ad41de7dada90ab09282a717d54f66a4`. No remaining confirmed engineering blocker. The controller may proceed with the reviewed maintenance sequence and authorized selected-owner synchronization. Actual personal metadata synchronization, model egress, service cutover and post-application protection checks are NOT completed by this engineering verdict.**

## Independence and frozen scope

D implemented or repaired none of the product, test, fixture, seed or migration files. This report and private acceptance harness/configuration/evidence are D's only authored artifacts. D did not commit/push. The original accepted source was4591f0a; the reviewed upgrade source is12569275. Source was archived with `git archive` into `/private/tmp/popcorn-legacy-D-12569275`; all application/SQL/race/build/browser gates below executed from that immutable archive, except the Git-dependent provenance check, which ran read-only in the active12569275 worktree. `git diff --check 4591f0a..12569275` passed.

Only isolated Supabase API54331 / DB54332 was used, via `/private/tmp/popcorn-phase1-test-stack/with-test-stack.py`. D waited for A to release database exclusivity. No reset, migration reapplication, personal54321/54322 database access or actual provider invocation occurred. Production-browser checks used D's new3104 production build, fixture mode, and the same frozen source. Personal3000 and controller3103 were preserved. Installed Next16.3.1 documentation was read before build verification.

## Independently executed gates

Every successful row below exited0. Implementer self-test reports are not substitutes for these fresh D runs.

| Gate | Observed result | Private evidence |
| --- | --- | --- |
| Full application tests | **1806/1806**:80 unit files/904 tests;11 contract files/256;33 integration files/583;4 prompt-golden files/63 | `/private/tmp/legacy-D-verify-12569275-network.log` |
| Full lint and typecheck | ESLint0 errors,4 existing unrelated warnings; `tsc --noEmit` passed | Same log |
| Provenance | **2 files/16 tests PASS**, run from frozen Git worktree | `/private/tmp/legacy-D-provenance-12569275.log` |
| Fresh production build | Next16.3.1 webpack, compilation/types/page generation PASS;55 routes; BUILD_ID `cAoJQz5Tt3gR_qdQcs19K` | `/private/tmp/legacy-D-build-12569275.log` |
| Complete real SQL | **23 files/1139 assertions PASS**, rollback suites, including new upgrade ownership/private ACL/hash/claim/CAS/classification/history cases | `/private/tmp/legacy-D-sql-12569275.log` |
| Real upgrade concurrency | **9 two-connection lock races PASS**, actual blocked connection observed; see matrix below | `/private/tmp/legacy-D-races-12569275.log` |
| Actual TypeScript runtime/repository/coordinator | Default runtime ignores global CI and requires owner consent; real concurrent coordinator exactly1 fixture model cycle; replay adds0 calls; source-deleted receipt replay preserves official history | Same race log; actual runtime driver invoked by the race harness |
| Extension regressions | **180/180 PASS**,0 skipped/cancelled | `/private/tmp/legacy-D-extension-12569275.log` |
| Production browser | **5/5 PASS**,25.5seconds,1 worker; existing returning-learner and saved-learning-loop suites | `/private/tmp/legacy-D-e2e-12569275.log`; screenshots `/private/tmp/legacy-D-e2e-12569275-output/` |
| Prepared modern near smoke | GET200,modern/near/Praise/Casual chat; real due date; correct mask/About/EN;1 browser Review GET,0 practice mutations;6 learning/archive tables deeply unchanged | `/private/tmp/legacy-D-near-12569275.log`, `.json`, `.png` |
| Prepared modern far smoke | GET200,modern/far/Suggest/Work & school; real due date; correct mask/About/EN;1 browser Review GET,0 practice mutations;6 learning/archive tables deeply unchanged | `/private/tmp/legacy-D-far-12569275.log`, `.json`, `.png` |
| Fixture/service cleanup | Temporary599/59a/52/53/55 owners0;54/56/57 demo families retain1 account each and57 exact identity matches. D's exact3104 PID/cwd verified then terminated; port closed; personal3000 PID42640 and controller3103 PID43691 unchanged | `/private/tmp/legacy-D-fixture-cleanup-12569275.log`; `/private/tmp/legacy-D-service-cleanup-12569275.json` |

The first restricted execution could not open local loopback sockets in the existing launcher integration suite (EPERM). The unchanged full command was rerun with local-listener permission and all1806 application tests passed. That second monolithic `verify` stopped at one Git-ignore provenance assertion because a `git archive` has no `.git`; the same16 provenance tests passed read-only in the real frozen Git worktree, and the production build then passed separately from the archive. Neither harness limitation was fixed by changing/skipping a product test. Initial logs are retained at `/private/tmp/legacy-D-verify-12569275.log` and the full-application log above.

The4 existing lint warnings are unused `_status` in scripts/process-local-jobs.mjs, `SavedItemAnalysisContentSchema` in tests/integration/jobs/process-jobs.test.ts, and `_userId`/`_savedItemId` in tests/integration/knowledge/source-traceability.test.ts. No new upgrade warning was observed.

## Real concurrency and preservation matrix

| Actual competing operations | Verified outcome |
| --- | --- |
| Source deletion holds its real source lock first | Publication waits and rejects STALE_PLAN; no metadata publication/deadlock |
| Consent revocation holds config lock first | Publication actually waits and rejects GATEWAY_CHANGED |
| Subtitle UPDATE holds segment lock first | Publication waits and rejects STALE_PLAN |
| New neighboring subtitle INSERT occurs first | Its real snapshot FK lock blocks publication; post-commit evidence change rejects STALE_PLAN |
| Publication wins before new neighbor INSERT | Insert waits; applied receipt remains exact and replayable |
| Publication wins before subtitle edit | Edit waits; applied receipt remains immutable |
| Publication wins before source deletion | Deletion waits; stored successful receipt survives deletion |
| Same UUID publishes from two actual connections | One authoritative applied receipt, identical replay; no duplicate publication |
| Publication wins before consent revocation | Revocation waits; already-applied receipt remains immutable |

The separate actual coordinator run uses the real repository/RPC and simultaneous upgrades: exactly1 fixture gateway completion and0 real gateway resolutions. It compares13 protected public tables deeply before/after, then deletes the synthetic source through the real deletion RPC and replays the same receipt with0 additional calls and5 official learning tables unchanged. The SQL suite additionally compares attempts, mastery, schedules, user expressions, prepared questions, Saved/highlights/artifacts, source/snapshot/segments/occurrences, private prepare operations, jobs and original canonical compatibility fields. Guarded59a cleanup finished and an independent final aggregate read found no temporary owners.

## Requirements review

- **Owner/source/sense proof:** strict real contract is consumed by planner, repository and CLI. Canonical valid modern cards, including empty usageSettings, are no-ops; partial metadata is preserved. Existing-card copy requires owned promotion-receipt/candidate-key/artifact proof; no spelling-only l-to-h conversion. Source fallback checks real owned occurrence/snapshot/ordered segments, exact evidence/times and a unique literal span, with deterministic original-Saved/earliest selection. Source pages are at most200 and uncapped overall; repository tests cover201 sources and bounded4-way context reads.
- **Prompt and model-call boundary:** unchanged Analyze-v3 builder/instruction framing and per-card normalization; ephemeral h1, one expression/request,3 preceding/2 following lines,2458 output tokens,30000ms, initial+3 shared format/card attempts and inner retry0. Model work follows the successful durable claimant and stays outside transactions. No generic template fallback, raw compatibility-field reconstruction, new legacy-generation/v4 path, hidden Review Analyze call or preparation-cycle reopening was introduced.
- **Classification:** complete not_expression card and reason remain private needs_review; canonical membership/mastery/Review exclusion behavior is not relabeled. SQL and coordinator cases preserve classification. Only complete validated expression metadata publishes.
- **Publication fences:** owner/sense/before/evidence/request/token/lease and active consented pin/revision/model are rechecked in the real transaction.042 locks consent;043 locks edited evidence;044 locks parent rows to fence new-segment/artifact FK insertions. Both real lock orders pass for affected races. Source/manual edits and expired/foreign claims cannot overwrite canonical metadata.
- **Durability and recovery:** same UUID/input replays before source/configuration reads and makes0 new model calls; changed signature conflicts. Competing UUIDs cannot duplicate active generation. Unknown publication checks authoritative receipts first and observes boolean failure persistence. A failed/uncertain request retains its existing ID; complete source-deleted receipt replay is supported.
- **CLI:** default owner-scoped dry-run performs0 model/metadata writes. Optional exclusive0600 manifest contains only identities/proof references/hashes, stable unique request UUIDs and owner/version. Apply rejects unsafe modes/symlinks/owner mismatch, serially consumes exact saved requests without planning or minting IDs, validates response identity, and prints only counts/IDs/status/fixed codes. Complete private cards/source/answers/credentials are omitted. Full focused contract coverage is included in the1806 run.
- **Historical behavior:** old compatibility fields, official prepared-question content/version/evaluation compatibility, attempts/answers, mastery, schedule, Saved/highlight/artifacts and failed prepare-cycle state remain protected. Existing v4 is historical prepared-question scoring compatibility; modern new questions retain the approved modern path. Full application/SQL/production browser regressions pass.

## Preserved real outputs and visual review

No prompt, budget, test fixture or golden directory changed from4591f0a. D independently compared bytes for the original actual20 output artifact, Analyze-v3 source and output budgets. The actual20 run artifact remains SHA256 `f5d122184fba34a865dbf6f992c688f8cb319e97631a53bb79f1ef6db31c29e8`; Analyze-v3 `399c86eb39e24615ef7492f99beb43b5fbd5ced01a0b823bf4cd5b86017eba78`; budgets `32381d663db479f517e4e1cc1005aaa9576c7a6c06052cee762831d483922911`. The separate human20/20 approval is explicitly recorded in review-situations-product-review.md. D did not regenerate those20 or substitute fixture quality for human approval.

D opened and visually inspected fresh production screenshots of masked Review, answer revision/first feedback, and far About/EN display. Blocks, meanings, controls and metadata are readable; target stays masked before disclosure; first/revision text comparison and immutable official result remain visible. Near/far smoke assertions independently verify one main/H1 and no browser mutation. Synthetic fixture question text is engineering evidence, not a new real-model quality endorsement.

## Reviewed deployment boundary — actual synchronization pending

The initial no-process-change assumption was correctly revised once038 outbox compatibility was discovered. The existing personal schema is024 according to the controller's fresh read-only preflight;038 will add6 pending preparation jobs, all belonging to the authorized owner, other-owner new count0. Old personal app/worker cannot consume that type safely. This remains a required maintenance sequence, not an additional product approval request.

D independently reviewed `/private/tmp/popcorn-upgrade-release.mjs`, `/private/tmp/popcorn-upgrade-maintenance.py` and `/private/tmp/popcorn-upgrade-observer.mjs`. Earlier exact-migration-date/environment-inheritance findings were repaired and re-reviewed. Maintenance helper27 pure/mock tests and independent observer forwarding/rejection/response-nonreading probe passed. The private detailed review is `/private/tmp/legacy-upgrade-D-maintenance-helper-review.md`.

Controller operating prerequisites remain: accepted-SHA archive built with actual54321 environment; preserve original checkout/user changes and running DB; record/exactly freeze effective claim ACL covering poller and cron; precisely quiesce old-app writes and drain existing work; final private selective backup and all-owner protected baseline; ordered migration manifest/old-column comparison; retain all6 new outbox rows at attempt0; explicit selected-owner manifest apply and same-ID zero-extra-call replay; independent read-only protected projections; compatible app health/BUILD_ID/schema/address validation; restore original exact ACL only when all new queue prerequisites are satisfied. Backup scope is public/private/auth/supabase_migrations, explicitly excludes Vault and is not a full-cluster credential restore; recovery must preserve existing Vault data. No popcorn:stop, database stop/reset, applied-migration rewrite, outbox deletion or fabricated terminal state is authorized by this engineering verdict.

**Actual application status at report issuance: pending. D has not observed any personal migration, model call, service cutover or modern-field change. After controller application D will independently read-only verify safe aggregate outcomes, same-request replay evidence and protected data, then append the separate actual synchronization result.**

## Evidence identity

Full private evidence hashes are `/private/tmp/legacy-D-evidence-hashes-12569275.json`. Key log SHA256 values:

- Full application/lint/types: `015d4b6d8296a2d465725e489822d944834736a9a31dafb8a33cad5be48ee124`
- Full SQL: `e0839274b0b075f27fe5831e6b2862708bcc6e4d68d3490cadb1010ebe08271a`
- Actual9 races/runtime: `c5aed2d8da6880b48e1a085273f518d95a72124ebd53838220e417e9e21758e4`
- Production5 E2E: `e1bab5d1308815e92cac1652a1638a4bcb11ac4f55039ad8e2607c0c72d48cf6`
- Fresh build: `9d8a7a15455f4ea5bd2a399492a4f412e5164a64fac3005845bf0c5a8ae48908`
