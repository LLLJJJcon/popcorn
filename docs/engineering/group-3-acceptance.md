# Group 3 independent acceptance — 2026-11-01

## Decision, scope and independence

**Group 3 engineering acceptance: PASS at `dabf1dca56353c3e9a4da1183915cf4f5bda0bd3`.** All nine confirmed §6.12 acceptance items pass with the evidence and scope below. No confirmed important implementation finding remains unresolved. This verdict combines independently executed full stable-source gates at701fa85, exact-byte inheritance for unchanged areas, and independently executed final-delta tests, type/static checks, production build and both browser suites atdabf1dc. It does not misrepresent the earlier full chain as freshly run against the later bytes.

Scope: confirmed §6/16.3, affected §5.2/5.13/5.14 and preserved §15 invariants, from merged Group2/main `0ff3bce4d3fba15e839cac9509b63e9bd4d11b54`. Shared interfaces/rulings are in [group-3-contracts.md](./group-3-contracts.md). Group4 due generation, masking, regeneration and scored revisions are not delivered or accepted here. Current Review continues to use its preexisting backend and local comparison behavior.

Reviewer `/root/acceptance` was different from implementation agents A/B/C and the controller implementing seed/E2E. This reviewer did not implement or repair product code, SQL, prompts, tests or seed, did not commit/push, and made no real model call. Findings were sent to original owners for repair. Reviewer-created private test/launch configurations and this report are acceptance artifacts only; no repository test assertion was changed to obtain a pass.

Both checkpoints ran from fresh `git archive` copies with existing `node_modules` symlink and temporary Git initialization for provenance checks:

- Full stable source: `701fa85eea38f4bbdd46849c58d1d33b9b8ab4b7`, `/private/tmp/popcorn-group3-acceptance-701fa85`.
- Final repaired source: `dabf1dca56353c3e9a4da1183915cf4f5bda0bd3`, `/private/tmp/popcorn-group3-acceptance-dabf1dc`.

No private dotenv was copied or loaded. Engineering uses the validated popcorn-phase1-groups24 wrapper, API54331/DB54332, CI and fixtures. Node24.13.1, pnpm11.25.0, Next16.3.1. Personal checkout/concurrent changes and generated next-env/dependency state are excluded.

## Independent gates and precise inheritance

| Checkpoint and gate | Independent result | Log/evidence |
| --- | --- | --- |
| 701: full `pnpm verify` | **Exit0**; lint0errors/4 existing unused warnings, typecheck clean | `/private/tmp/group3-final-verify-701fa85.log` |
| Included unit / contract / integration / golden / provenance | **70files/614**, **8/227**, **30/562**, **3/48**, **2/16** PASS: **1,467 tests /113files** | Same log |
| Included production build | **Exit0**,28 static pages | Same log |
| 701: complete extension suite | **180 PASS**,0failed/skipped, exit0 | `/private/tmp/group3-final-extension-701fa85.log` |
| 701: all frozen rollback SQL/RLS tests | **16files /890 assertions PASS**, exit0 | `/private/tmp/group3-final-sql-701fa85.log` |
| 701: real two-connection promotion regression | **Both races PASS**, exit0: same-attempt replay and same-candidate cross-round uniqueness | `/private/tmp/group3-final-concurrency-701fa85.log` |
| 701: real seed twice with different reference clocks | **PASS**, same IDs and byte-equivalent full returned rows across15 owner tables; actual queue2Review/1Second/3New/12minutes | `/private/tmp/group3-final-demo-seed-701fa85.log` |
| dab: final affected Practice + Vault/Practice regression | **13files /123 tests PASS**, exit0 | `/private/tmp/group3-final-delta-tests-dabf1dc.log` |
| dab: whole TypeScript, incremental disabled | **Exit0**, no diagnostics | `/private/tmp/group3-final-delta-types-dabf1dc.log` |
| dab: scoped Practice/page/integration ESLint | **Exit0**, no warnings/errors | `/private/tmp/group3-final-delta-lint-dabf1dc.log` |
| dab: reviewer supplemental lifecycle harness | **2 PASS**, exit0;16 copied baseline cases deliberately unselected | `/private/tmp/group3-final-lifecycle-dabf1dc.log` |
| dab: fresh clean production build | **Exit0**,28 static pages | `/private/tmp/group3-final-build-clean-dabf1dc.log` |
| dab: both required suites on independent production3104 | **5/5 PASS,18.0s**, exit0, one worker | `/private/tmp/group3-final-e2e-dabf1dc.log` |
| Full-range and repair-delta whitespace | `git diff --check 0ff3bce dabf1dc` and `git diff --check 701fa85 dabf1dc`: **exit0** | `/private/tmp/group3-final-delta-byte-evidence-dabf1dc.json` |

Full stable-source command, run from its archive:

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false verify
```

Final-delta commands, run from its fresh archive:

```sh
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures node node_modules/vitest/vitest.mjs run src/features/practice tests/integration/memory/vault-practice.test.ts
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures node node_modules/typescript/bin/tsc --noEmit --incremental false
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures node node_modules/eslint/bin/eslint.js src/features/practice 'src/app/(app)/practice' tests/integration/memory/vault-practice.test.ts
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures NEXT_TELEMETRY_DISABLED=1 pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false build
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py python3 /private/tmp/group3-browser-acceptance.py /private/tmp/popcorn-group3-acceptance-dabf1dc --trace retain-on-failure
```

SQL command used the installed frozen dependency CLI: `supabase test db --local --workdir /private/tmp/popcorn-phase1-test-stack` followed by **all16 absolute frozen SQL paths**, enumerated in its log. It never used the personal project or db reset. Concurrency ran `bash tests/contract/practice-promotion-concurrency.sh` with POPCORN_TEST_DATABASE_URL mapped in memory from isolated DATABASE_URL. SQL, concurrency, actual seed and browser checks ran sequentially, with no concurrent DDL/backfill/fixture cleanup.

Seed used a private copy of `/private/tmp/popcorn-phase1-test-stack/group3-demo.mts`: all **three** module imports (seed, repository, domain) were bound to701's archive. The original two executions, exact15-table row comparison and live service assertions were unchanged. Owner54 was checked against its reserved email first. Snapshot SHA-256: `032f78f6cf214c67d88bff4e5c257d1442543d943c1a4f4fbe66715315d7b282`. Current result ordering was Review,Review,Second try,New,New,New; needsAnalysis1 and processing0.

**Inheritance is byte-proven.** Relative to701, dab changes only four Practice implementation modules, two Practice test modules and three reports/ledger documents. Independent path-list plus every-file byte comparison proves unchanged:118 server/contracts/types files;51 SQL files;53 seed/E2E/extension/contract files;98 Home/Saved/app files;5 build/package configurations. Evidence `/private/tmp/group3-final-delta-byte-evidence-dabf1dc.json` contains manifest hashes and the complete changed-file list. Consequently the stable full backend/Home/contract/provenance/extension/SQL/concurrency/seed evidence remains applicable; changed client modules received fresh tests/types/lint/build and production browsers. Counts are not summed to pretend all are unique tests.

A separate full-range comparison proves all29 preexisting migration files and all26 AI/provider/prompt/budget files identical to accepted0ff3bce (`/private/tmp/group3-final-source-invariants-701fa85.json`); the final delta changes neither set. Before production execution,391 files under src/scripts/supabase/tests were again compared to final Git blobs: **zero changed**, manifest SHA-256 `64d9f3e27320bc1ccf8de7805854b012beec9cc2afed7256263b43fae01c69f6`.

One acceptance-tool failure is retained transparently: the first final build compiled product code but TypeScript then rejected the reviewer's newly added temporary `vitest.acceptance.config.ts` explicit `.ts` import (TS5097). That config and supplemental harness were moved out of the build tree to `/private/tmp/group3-private-harness-dabf1dc`; no product source/test was repaired. The clean build passed. Failed log `/private/tmp/group3-final-build-dabf1dc.log`; passing build log listed above.

## Confirmed §6.12 matrix — all nine items

| # | Required behavior | Independent conclusion and evidence |
| --- | --- | --- |
| 1 |2Reviews/1Second/3New,12minutes, correct order/descriptions | **PASS.** Actual two-pass frozen seed and final production mixed-session test assert exact summary and2/1/3 rows. Shared labels/descriptions/anchors are contract-tested; real SQL tests verify ordering and full counts. |
| 2 |Start traverses all six; Next/last Finish; All done and summary | **PASS.** Final real browser completes two Reviews, Second try and three New; official responses drive six unique result rows,3added/2moved-up summary and All done. No three-item session cap remains. |
| 3 |Exit shows summary, excludes completed, Start continues remainder | **PASS.** Real native Exit click navigates to/practice after first Review; stored summary remains, full queue reports1/1/3 and restart5left. No forced navigation replaces the click. Finished-session boundary is separately rechecked below. |
| 4 |Refresh restores summary and current server-selected item | **PASS.** Production Round3 refresh restores the same unanswered task and4left. Stable-ID storage, optional/corrupt/foreign-owner cases, current-hint server validation and stale-state cases pass. No browser storage is accepted as official learning evidence. |
| 5 |New situation stays same item/count; Remove advances immediately | **PASS.** Production Second try Round2→Round3 keeps4left. Remove advances immediately across items; Undo preserves the next item and restores authoritative state. Independent supplemental final-case Undo cancels finished and reopens the restored unanswered item. Official revisions do not create extra summary entries. |
| 6 |Individual list item opens alone and returns to/practice | **PASS.** Final returning-learner browser clicks the actual Review row, checks official201 result, then Back to Today's practice and verifies URL. Candidate list tests verify existing-task reuse and encoded returnTo=/practice; first-practice safe-return and standalone Vault redirect regressions pass in the fresh123. |
| 7 |Home New-only priority, three counters/descriptions, gray zeros, anchors, recent3/local date | **PASS.** Frozen Home selector tests include0/0/3 and Second-only cases, gateway precedence and server estimates. Shared-copy/counter/anchor/gray-zero/recent3 tests and timezone/hydration tests pass in stable full verify; files are byte-identical at final. Real SQL recent3 covers102sources, newest save on an older source. Final production mixed Home directly links to session; width/landmark cases pass. |
| 8 |True empty/no analysis gives YouTube and real next local date on both pages | **PASS.** Final mixed browser completes queue, verifies Analyze while one missing analysis remains, then removes only its reserved missing-analysis mark and verifies Home and Practice YouTube actions plus actual next date. Null next date omits the line in units; no tomorrow is fabricated. |
| 9 |Updated due/Home/runtime/returning-learner regressions pass | **PASS.** Stable full614unit/227contract/562integration/48golden/16provenance; final Practice123, clean types/lint/build and both required production suites5PASS. Old three-cap/Continue/Stop assertions were replaced with specified behavior; negative identity/owner/provider/assistance/completion checks remain. |

## Read-only queue, owner and compatibility review

Production pages and all today/next/task-material handlers use the authenticated owner and the actual new Today runtime/repository, not legacy listDue's100-item projection. Responses/errors are no-store; POST next retains session/Origin/JSON/64KiB safeguards. HTTP tests use301 exclusions, reject invalid/unknown/oversized input explicitly and verify owner binding. A transport byte bound does not silently truncate exclusions or introduce a product session count cap.

SQL uses the same owner-filtered read-only eligibility functions for aggregate summary, pages, next and per-source counts. Review is pending/due first; Second try is current due retry/open round≥2 second; New is explicit expression suitability or a previously opened unanswered first round last. Stable owner/candidate identity deduplicates all historical readable versions; malformed newer metadata cannot shadow an older valid card. Older-only generated cards and cards whose mark was removed remain. Untouched legacy suitability remains unknown; explicit legacy/not_expression open1 restores its exact task. Removed/promoted candidates and future automatic retries are excluded; a verified current manual future-open hint can resume once without enrolling it in ordinary counts. Retry1 displays/enters round2; open2 reuses its task.

Real SQL asserts101Reviews+205New plus one Second try,200+107 pages,301 exclusions, foreign hints, current future-open count-once and superseded hint rejection. Domain tests exhaust501 rows as200/200/101 with bounded serial reads. Summary is a full aggregation, not the size of a capped page. No per-card state RPC amplification was added. needsAnalysis counts qualifying saves with at least one unmatched active mark, not marks or generic ready items; matching uses retained highlight ID or exact compact location/text identity. Recent3 derives latest visible save across all sources. Failed saves contribute only to the specified secondary processing cue; unsupported is excluded from it.

New migrations029–031 only add/repair queue functions.031 explicitly aligns schema-readable optional metadata and fallback-to-older-valid selection; it changes no stored evidence. All four public read RPCs are server-only, underlying private helpers have browser/service direct grants revoked, and HTTP supplies the authenticated owner. No new table needed a new RLS policy; the full existing RLS/old source-deleted replay/022 long-card/023 no-confidence/backfill/receipt suites and actual promotion races passed. Original receipts, source evidence, mastery1/7/30schedule and candidate locks were not weakened. No shared private gateway fingerprint/history or existing migration text changed.

Home priority is gateway→nonempty queue→qualified analysis→YouTube. Its exact summary/recent3 comes from Today service; retired unsortedSaveCount/due-only Saved.home is removed. Saved's needs-analysis route uses the full shared predicate and exhausted pages; URL modes reset stale local filters. Local dates mount in the browser with stable SSR placeholders; the Los Angeles opposite-UTC-date and recoverable-hydration-error tests pass.

## Independent findings and verified repairs

1. **Finished-session exclusion lifetime — repaired.** The preaudit found all-done clearing only current while retaining completed stable IDs forever in the tab, excluding the same expression when it later became Second try. Final code marks display-only finished only after server next=null; fresh work on a later Start resets the completed/current/exclusion set. Unfinished Exit/refresh continues; no new work preserves the recent summary. No date rollover or scheduling rule was invented. Final private harness explicitly restores the **same stable ID as a due Second try**, proving old exclusions/results clear; final-item Remove→All done→Undo proves finished=false and reentry. Both pass against final code.
2. **Late action response paired with the next item — repaired.** Next was previously active during new-round/removal work, and delayed callbacks read active.current for the next item. Fresh real-component deferred-response tests hold HTTP, advance toB, releaseA, and confirm B material/hint/summary stay unchanged. Next is disabled while busy; callbacks capture original item/task and verify mounted/active identity/operation sequence. Revised answers and extra rounds replace one stable result rather than adding items. One-main/h1 hierarchy and loading headings also pass.
3. **External promotion interrupted session — repaired.** Activation's Vault redirect and actual ALREADY_PROMOTED409 formerly sent the whole session away. Final session clears the obsolete hint and freshly selects remainingB, without adding an external Added outcome. Actual first-answer/new-round conflict and late invalidation cases pass. Standalone keeps its existing Vault redirect.
4. **Review already completed elsewhere trapped retry — repaired.** Production GET requires pending and throws domain NOT_FOUND, publicly **404/FORBIDDEN**; a different-answer completed POST throws REVISION_CONFLICT, publicly **409/CONFLICT**. Final client retains status and only these exact pairs trigger a session-owned full-queue confirmation. It advances only when that Review is absent. Still-eligible404/409, provider503, failed confirmation and standalone behavior retain the original item/text/error path. Actual201 same-answer replay stays a normal official completion. Tests render actual components and actual public envelopes, including late confirmation/obsolete callbacks; no fake public NOT_FOUND enum or backend/group4 completion protocol was introduced.

Controller/C's earlier native Exit hit-target failure and geometry-only correction are retained in their reports. Final independent browser used the unchanged real Link click and verified navigation; the screenshot shows a clear Exit target and separated title. No force-goto, weaker E2E assertion or fabricated learning result was used to bypass the failure.

## Visual inspection, boundaries and cleanup

Independently viewed final production screenshots:

- `/private/tmp/group3-final-e2e-results-dabf1dc/returning-learner-today-s--12567-and-finish-with-one-summary-chromium-web/group3-session-finished.png`
- Same directory `group3-queue-empty.png`.
- `/private/tmp/group3-final-e2e-results-dabf1dc/saved-learning-loop-saved--06a77--knowledge-and-due-Practice-chromium-web/group2-round2.png`.

The finished page has one page heading, full progress, six readable outcome rows, totals/local next date and distinct completion buttons. The empty page retains the latest summary, shows the required empty/YouTube action and real date. The retained first-practice page has its correct phase/context/source/disclosure/input layout. No important visible layout defect was found in these captures. Automated width/landmark assertions cover the required target widths; this is not a claim of manual inspection on every device. Synthetic situations and fixture scores are engineering evidence, never model semantic quality.

No real model call occurred in Group3 acceptance. Group2's four700-token observations and optional-coaching/positive-case limitations remain historical, not newly passed. Group3 AI/prompt/budget bytes are unchanged from accepted main; the main1844-token/two-flag configuration has no new live-quality verdict here. The explicit no-generic-production-fallback override remains intact. Existing prepared tasks and retained-state/Try again behavior are preserved. Group4's20-question human review and remaining due redesign are still separate and unperformed.

Production used only final frozen build on3104, with a private config selecting the two required suites, one worker and no dev webServer. Isolated DB URL was mapped only in process memory. After screenshots/tests, only reviewer-created3104/PID59914 was stopped after verifying both exact listening PID and frozen cwd; service session ended143 from intentional SIGTERM. An initial conservative cleanup guard rejected lsof's extra descriptor record before sending any signal; parsed PID+cwd guard then succeeded. Personal3000/PID42640 and controller3103/PID43691 remained listening. Test stack54331/54332 was retained; personal54321/54322 were not used.

Read-only final cleanup confirms zero reserved52/53/55/concurrency identities, zero corresponding promotion/due receipts and promotion gate sessions;54 demo owner remains. Latest applied versions are031/030/029. Evidence `/private/tmp/group3-final-cleanup-dabf1dc.json` and `group3-final-services-dabf1dc.json`. No database reset, unrelated-owner cleanup, original-checkout modification, commit or push was performed by this reviewer. Controller owns PR delivery/ready/merge and subsequent group release.

Complete22-artifact sizes/SHA-256 manifest: `/private/tmp/group3-final-evidence-manifest-dabf1dc.json`. Key hashes: stable verify `b2abe6644ba9af28c637b6d1e1159fd58668969fcc6dc16c128486ade2a6e540`; final123 tests `4a02a35770dd0a1d64ca5e39303f37dd62c80c92cf4c18113eb3d21c564c1656`; clean production build `e3e73dd0fc06e2e3bf34d49033e83507f324a55a9ff01c56de98f553ce271710`; final5E2E `ca523e49d73ff55fad540e55fed96032b421fd1c182e0a5c0d80db2423b5a516`.
