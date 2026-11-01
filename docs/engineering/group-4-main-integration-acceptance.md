# Independent acceptance — main deletion integration and legacy upgrade

2026-11-02, Asia/Shanghai. Independent acceptance agent D.

**Current final result: ENGINEERING PASS / DATA PASS / OPERATING PASS. All6 authorized old cards were synchronized, all6 ordinary new Review preparations succeeded, and the compatible personal application and original claim permissions are operating. The initially pending stages below are retained as dated acceptance checkpoints; final actual evidence is recorded in the two addenda.**

**Final engineering verdict: PASS for `3f43ec7e479545220ca124b699e896c668f86215`. No remaining confirmed product or engineering blocker. The controller may execute the reviewed, authorized personal maintenance/synchronization sequence. This verdict does not claim actual personal migration, metadata synchronization, real-model completion or service cutover. Those outcomes require a separate post-application read-only check.**

## Frozen source and independence

This is a fresh acceptance of the merged main deletion feature and upgrade/revision compatibility repairs045–048. It does not inherit12569275's PASS. The old report remains historical at `docs/engineering/group-4-legacy-learning-card-upgrade-acceptance.md`.

D did not implement, repair or modify repository product/test/fixture/seed/migration logic, and did not commit/push. All full application, SQL, race, seed-wrapper, build and browser runs used a `git archive` of3f43ec7e in `/private/tmp/popcorn-main-D-3f43ec7e`. The Git-dependent provenance tests ran read-only in the same frozen-source worktree. D authored this report and private test orchestration/browser observation support only. Existing browser suites and seed implementation/assertions were retained. Source diff-format check passed.

## Full migration order was rebuilt independently

The controller explicitly authorized reset of only project `popcorn-phase1-groups24` under `/private/tmp/popcorn-phase1-test-stack`, API54331 / DB54332. D independently checked exact project/ports, confirmed0 active client requests and0 leased jobs, and verified all50 migration files matched3f43ec7e bytes before reset. No other stack or personal54321/54322 database was accessed.

A private full backup of this synthetic test database was taken in0700 `/private/tmp/legacy-D-fresh-backup-3f43ec7e`, with0600 archive, pre-reset owner/migration inventory and a successful `pg_restore --list` check. Archive SHA256: `1ae39328bb7386d3e78297bc6c4f4cd1ea24653d977461f8d6d80fd78e0f6e15`. It contains only the owned test stack's synthetic state.

D then executed the standard `supabase db reset --workdir /private/tmp/popcorn-phase1-test-stack --local --yes`. It completed successfully, including seed/container restart. The actual log confirms032–042, then already-main `20261101235900_expression_removal.sql`, then043–048 in sorted order. Thus the dynamic function-repair anchors were exercised from a clean schema, not accepted from a manually accumulated A database. Final database history contains50 versions, latest202611020048.

## Fresh independently executed gates

Each successful row exited0. All model-related tests used fixtures/inert synthetic gateway records; no actual provider call was made.

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Fresh complete migration reset/order | **50 migrations PASS**, includes235900 and045–048 | `/private/tmp/main-D-fresh-order-3f43ec7e.log` |
| Full application | **1833/1833 PASS**:85 unit files/928 tests,11 contract files/257,33 integration files/585,4 prompt-golden files/63 | `/private/tmp/main-D-verify-3f43ec7e.log` |
| Full lint/types |0 lint errors,4 existing unrelated warnings; `tsc --noEmit` PASS | Same log |
| Production build | Next16.3.1 webpack compilation/types/page generation PASS,55 routes, BUILD_ID `TZ2Bv36ogUJ-d3X-z2KdS` | Same log |
| Provenance | **2 files/16 PASS** | `/private/tmp/main-D-provenance-3f43ec7e.log` |
| Full SQL on fresh database | **25 files/1188 assertions PASS**, all rollback suites, including main expression-removal and new upgrade/removal/revision cases | `/private/tmp/main-D-sql-3f43ec7e.log` |
| Original upgrade races/runtime | **9 actual two-connection lock races PASS**; actual repository/coordinator concurrent model cycle1, exact-ID replay adds0 calls, source-deleted replay preserves official graph | `/private/tmp/main-D-races-3f43ec7e.log` |
| Added removal/official races | **6 actual two-connection lock races PASS**, actual blocked waiter observed and guarded59b cleanup0 | Same log |
| Extension | **180/180 PASS**,0 skipped/cancelled | `/private/tmp/main-D-extension-3f43ec7e.log` |
| Existing production browser suites | **5/5 PASS**,19.5seconds,1 worker | `/private/tmp/main-D-e2e-3f43ec7e.log`; `/private/tmp/main-D-e2e-3f43ec7e-output/` |
| Modern near and far smoke | Each GET200, correct transfer/function/setting, target mask/About/EN,1 Review GET,0 browser practice mutations;6 protected tables deeply unchanged per smoke | `/private/tmp/main-D-smokes-3f43ec7e.log`; `/private/tmp/main-D-near-3f43ec7e.json`; `/private/tmp/main-D-far-3f43ec7e.json` |
| Removed completed history, actual production browser | GET200; canRevise:false; first/latest/First feedback/navigation remain; no revision button/editor/submit; original localStorage draft unchanged;1 Review GET,0 practice mutations;7 protected tables deeply unchanged | `/private/tmp/main-D-removed-history-3f43ec7e-green.log`, `.json`, `.png` |
| Synthetic demo rebuild/replay | Existing seed wrappers rebound to frozen imports rebuilt54/56/57. Each second run retained IDs and all15 table rows;2 real-published prepared near/far archives and queue2 review/1 second try/3 new/12min preserved | `/private/tmp/main-D-demo-rebuild-3f43ec7e.log` |

All `verify` gates were run: lint/typecheck/full application/build sequentially in the immutable archive, provenance separately in Git worktree because ignore checks require `.git`. No test was skipped or weakened to accommodate the archive. The existing4 lint warnings remain unused variables/imports in local-worker, job-test and source-traceability files.

## New main interaction review and evidence

- Main's icon-only Saved/Vault deletion and owner/origin protections remain merged. Saved removal preferences stay separate from Vault membership and immutable artifacts. The complete deletion/component/search/projection/queue tests are included in the1833/1188 fresh runs.
- Removed Vault rows are excluded from new upgrade plan/context. Claim and publication check the active owned user-expression row. Deletion during generation cannot publish metadata or revive a cancelled review. Completed same-UUID upgrade receipts still replay read-only.
- New045–048 locks establish user-expression before source/evidence/sense for upgrade claims/publication, while maintaining the established owner-not-found projection. The6 new real races cover removal before claim, removal before publish, claim before removal, publication before removal, official completion before upgrade and upgrade before official completion. They prove no resurrection, duplicate learning event or deadlock/lock inversion; a waiting claim also cannot prematurely own the sense lock.
- The9 original real races were rerun after fresh order: source deletion, consent revocation, subtitle UPDATE and neighboring INSERT winning first all fence stale publication; reverse publication-first cases retain exact immutable receipts; same-UUID concurrent publication returns one authoritative result.
- Removed completed Review history remains readable. New revision requests are rejected before gateway resolution/claim; active-expression SQL fences reject new claim/publication if removal wins, while original completed revision UUIDs retain historical replay. Original completed official reviews/answers/revisions are preserved; next pending review cancellation from deletion is retained.
- Optional server canRevise:false is projected through current context for GET and replay responses. Older DTOs and active true remain compatible. The client hides revision entry/form, guards submission and autosave, ignores a restored draft for editing without deleting it, and retains first/latest feedback and standalone/session navigation. D independently ran97 focused UI/domain/contract/repository cases plus scoped lint/read-only types before final freeze; the full fresh suite includes these again.
- D's additional actual removed-history browser read confirms the capability projection, controls and retained draft against real SQL history/removal, rather than relying solely on component mocks. Seven public learning/history tables remained row-for-row identical during that observation.

## Private observation support and visual review

The standalone extra removed-history observation reused the existing removal SQL fixture under reserved59c IDs. Initial private harness runs lacked pgtap and GoTrue-required auth timestamps (SQL-only fixtures do not log in). D added those dependencies/auth-only login support outside the repository; the latter root cause was confirmed by the test Auth container's structured `created_at` scan error. No shipped test/assertion, product code or seed logic was changed. The final browser observation passed and every attempted run used guarded finally cleanup. The temporary pgtap extension was removed afterward. These harness startup errors are not hidden product failures and did not invalidate the already-passing mandatory gates.

D opened and inspected fresh masked Review, far About/EN and removed completed-history screenshots. Target masking, readable controls, first/latest comparison and first feedback are intact; the removed-history screenshot has navigation but no new revision controls. These synthetic screenshots demonstrate engineering/UI behavior, not new real-model semantic quality.

No prompt/budget, original actual20 output or golden artifact changed through this integration. The approved actual20 artifact remains SHA256 `f5d122184fba34a865dbf6f992c688f8cb319e97631a53bb79f1ef6db31c29e8`. The separate explicit human20/20 approval stands; D made no new actual20/provider call. No generic fallback/raw-field/new-legacy-v4 generation branch was introduced.

## Cleanup and actual deployment boundary

Final aggregate read: temporary599/59a/59b/59c/52/53/55 owners0; rebuilt54/56/57 demo families each1;50 migration versions, latest048. Demo random prepared-task IDs changed during the expressly authorized fresh reset/rebuild; immutable replay checks apply within each rebuilt demo, not across the reset. Pre-reset synthetic state remains privately backed up. Evidence `/private/tmp/main-D-cleanup-3f43ec7e.log`.

D verified PID84919 owned port3104 and cwd `/private/tmp/popcorn-main-D-3f43ec7e`, then terminated only that temporary server. Port3104 is closed. Personal3000 PID42640 and controller3103 PID43691 remained unchanged. No personal database/model/service write or signal was performed by D. Evidence `/private/tmp/main-D-services-3f43ec7e.json`.

The controller's personal migration baseline is now a legitimate non-prefix subset after concurrent main deployment, not024. D independently reviewed the revised private maintenance helper:36 pure/mock tests PASS, ordered-subset/unknown/duplicate/unordered guards and exact missing migration list; exact target history remains required afterward. Existing old-column protection includes removal flags. The10-function SHA checker is an additional read-only proof that missing032–042 migrations do not overwrite already-applied235900 deletion/round/queue functions. Reviewed release environment isolation, exact-SHA archive, claim ACL gate and observer request forwarding remain required. These offline helper reviews do not substitute for actual maintenance evidence.

**Actual personal synchronization status at this engineering report: pending.** Controller may now follow the reviewed maintenance sequence: freeze exact claim ACL, quiesce old app/drain, final private backup/protected snapshot/function hashes, apply only exact missing migrations without reset/reapplying main, compare old columns/functions, run selected-owner stable manifest and zero-extra-call replay, validate compatible actual-env app and queue prerequisites, then restore exact ACL. Keep original checkout/user changes and running DB intact. D retains the separate task to independently read-only verify protected projections, aggregate outcomes and actual synchronization evidence afterward.

## Evidence hashes

Manifest: `/private/tmp/main-D-evidence-hashes-3f43ec7e.json`.

| Evidence | SHA256 |
| --- | --- |
| Fresh migration order | `17139e6f656b35541443fbad34dcab4f3673f8fff54ef7cd3ea6d0a10f49b97b` |
| Full application/lint/types/build | `246cd6c43c1c645dae2f440cda0b15abc4a579d1984e93d86560713f5604f43d` |
| Full SQL | `947a72e2efb0052d4ec9751923b526c6f6d638f8c5e895d6a1120f3cdefd77a2` |
|15 races/runtime | `4b2d0d630a29112b36a2eadd6af06c0acda487f02083df21f6fe24925a3bf4e3` |
|5 production E2E | `219f4e9140853dcd444e2cf2550bf2960770238fd88643a0cbaa6ef1b35eb706` |
| Removed-history production observation | `aaab9bfabb4b00ab3221f08ccd6ba562a7d0e10953dcc4427da732a0d780411e` |

## Independent actual metadata synchronization — DATA PASS

2026-11-02, after the controller's explicit read-only handoff. D independently connected to actual local DB54322 using readonly transactions, re-captured the current29 public/private tables, and reran pure comparisons against the private before/migration/first-apply/replay snapshots. D performed no database/model/ACL/service mutation.

**Actual metadata verdict: DATA PASS. All6 authorized source-based records have complete applied modern-card receipts;0 blocked/failed/needs-review/in-progress. Application cutover and claim-ACL restoration were still pending at this data verdict.**

- Reproduced migration comparison across all25 prior tables/old columns and confirmed only the expected6 owned pending preparation jobs were added. The current6 jobs are still pending/attempt0/unleased; no preparation cycle was consumed during metadata synchronization.
- Reproduced29-table metadata protection: only6 selected canonical senses'9 modern fields/normal updated_at and6 manifest-bound private terminal receipts changed. Original compatibility fields, question/answer/history/mastery/schedule, Saved/highlights/artifacts/removal flags, existing jobs and other owners remain equal to the protected baseline.
- Fresh current capture, first apply and same-manifest replay have identical stable snapshot SHA256 `35869fe8db72a8a93fcaadcbd7560ea07a9c2ffecd13f069ea7a5f9e83a1a8da`. Thus replay produced no additional stored change.
- Independently checked6 stable request/sense identities against the private manifest and both safe reports. Actual readonly SQL validated operation workflow/status, request/target hashes, complete expression cards, model-origin/Analyze-v3 provenance and the exact currently active consented config pin/revision/fingerprint/model for all6 receipts.
- Dry-run/apply/replay audit counts are0/6/0 fetch attempts. All6 apply attempts returned HTTP200 with the approved requested model and2458 output-token cap; no recorded transport failure. The observer records request configuration/status, not provider response-model identity or billable token usage.
- Independently checked the10 upstream deletion/round/queue function hashes before/after equal; the private selective backup's bytes match its stored hash;50 migration versions match the pinned release.
- Independently checked original checkout HEAD, complete NUL-delimited Git status and the recorded modified tracked-file hash unchanged. The original app PID42640 remained stopped in its original directory and effective claim EXECUTE remained false. A preliminary ordinary-short-vs-NUL-status comparison was a harness format mismatch; comparison using the original exact `--porcelain=v1 -z` command passed byte-for-byte.

Private evidence: `/private/tmp/popcorn-upgrade-maintenance-3f43ec7/D-readonly-data-verdict.json`, `/private/tmp/D-personal-readonly-check.py` and `/private/tmp/D-personal-readonly-check.log`. These contain no report-facing source text, answers or credentials. The controller was notified of DATA PASS immediately, before report writing, so it could proceed with the reviewed compatible-app cutover. D retains the separate readonly verification of final listener/release identity, original-source preservation and exact claim ACL restoration.

## Final independent operating verification — OPERATING PASS

2026-11-02, after the controller's compatible-app cutover and precise claim-ACL restoration. **Final outcome: ENGINEERING PASS / DATA PASS / OPERATING PASS. Actual authorized synchronization and the reviewed local service transition are complete.**

D performed only safe unauthenticated HTTP GETs, filesystem/process reads and readonly database transactions. No POST, model invocation, database/ACL mutation or service signal was sent by D.

- New PID90369 listens on personal port3000 from `/private/tmp/popcorn-group4-release-3f43ec7e4795`. Deployed src/scripts/migration source bytes independently match the accepted3f43ec7e archive. Actual BUILD_ID is `gCTSunWc88tVoi62ajMH6`; GET of its served build manifest matches local build bytes exactly, SHA256 `f536057fade3d7f70250238b9c7725d06899399ccdcddf95519f3ba80d814a1b`.
- Fresh GET `/sign-in` returned200; unauthenticated Today GET returned401. Actual server build contains personal API54321 and no test API54331. D did not assume public browser chunks must contain a server-side authentication endpoint.
- Personal DB54322 is running; D's transaction verified readonly mode and50 exact accepted migration versions. Function owner/effective privilege/grantor/grantee/grant-option ACL equals the recorded original ACL, with claim EXECUTE effective=true. The maintenance phase is restored.
- Old Next42640 is retired; the existing HTTP worker42634 is alive and running. Original checkout HEAD, complete NUL-delimited Git status and recorded modified tracked-file hash remain unchanged. Only the separate release serves the updated application.
- A fresh post-resume capture retains every sealed old row. Differences are restricted to normal processing of the6 authorized new outbox jobs/internal results and their owned new prepared tasks/scenario snapshots/private prepare operations. Existing official questions/answers, attempts, mastery, schedules, Saved/artifacts/removal flags, original jobs, other owners, upgrade metadata and private upgrade receipts remain unchanged.
- At D's fresh read all6 new jobs were **succeeded** and all6 new questions were prepared through the modern model path. This ordinary post-resume preparation is separate from the sealed metadata operation's observed6 HTTP requests; the metadata dry-run/apply/replay counts remain0/6/0 and no further metadata synchronization call was made by D.

Private independent evidence: `/private/tmp/popcorn-upgrade-maintenance-3f43ec7/D-readonly-operating-verdict.json`, `/private/tmp/D-operating-readonly-check.py` and `/private/tmp/D-operating-readonly-check.log`. The controller received OPERATING PASS immediately before this report update. No unresolved engineering, data-protection or operating blocker remains from this acceptance.
