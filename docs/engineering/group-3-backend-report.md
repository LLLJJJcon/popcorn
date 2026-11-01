# Group 3A queue/backend implementation report

2026-11-01. Implementer `/root/phase1_rounds_preflight`, isolated worktree `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-group3-confirmed`. No commit, push, independent reviewer dispatch, personal database mutation, UI, seed or E2E edits were performed by this implementer. This is implementer self-test evidence; separate group3 acceptance still gates group4.

## Authority and interface release

Read AGENTS, installed Next16.3.1 route-handler/page guides, the confirmed complete sections6/16.3 and relevant5.2/5.13/5.14, current implementation plan, actual accepted group2 code/contracts and the older groups3–4 preflight. Async route params are awaited. Owner-specific responses are authenticated and no-store. Initial read-only differences and explicit controller rulings are recorded in `group-3-preflight.md` and `group-3-contracts.md`.

Shared `today-practice.ts` schemas/constants passed missing-module RED then4-test GREEN and were published to B/C before their functional work. Actual exports match the frozen document: ordered group descriptions/anchors, summary, Review/candidate union, recent videos, next request/response, Home data and session-result schemas. `learning-config.ts` adds the specified two-minute estimate without changing the other learning constants. Latest generated types include the public/private queue functions; nullable highlight mutation fields, candidate projection columns and trigger-populated draft insert defaults remain intact. Nullable next-refresh arguments are explicitly refined because the generator omits SQL argument nullability.

The controller initially released implementation after independently accepted merged-source group2 results; group2 later passed all CI and merged main at `0ff3bce4d3fba15e839cac9509b63e9bd4d11b54`. The separate branch/publication procedure does not change product acceptance gates.

## Delivered backend behavior

| Requirement | Actual implementation and evidence |
| --- | --- |
| One common owned pool | Migration029 defines owner-filtered private candidate-card, candidate-row, due-Review and needs-analysis functions. Summary, item pages, next and per-source counts reuse those functions. Public RPCs are executable only by service_role; browser roles cannot choose an owner. HTTP always supplies the authenticated owner. |
| Full counts, bounded pages | Summary aggregates the entire eligible pool. Items and needs-analysis video lists have a per-call maximum200; the domain exhausts serial pages until fewer than200 return. There is no maximum page/item/exclusion count. Tests retain101 Review+1 Second try+205 New, with200+107 item pages, and domain tests exhaust501 rows in200/200/101 batches. |
| Stable retained historical cards | All readable v1/v2/v3 saved analysis artifacts participate. Latest schema-valid version wins per stable group2 candidate key; an older-only card remains. SQL and TypeScript share an asserted golden stable candidate UUID. Neither a new round nor a new artifact changes this item ID. Mark removal preserves generated cards. |
| Exact automatic qualification | Untouched New requires explicit expression suitability and a visible bookmark. An owned latest open/unanswered round1 remains New and reuses its task, including legacy/unknown and explicitly opened not_expression cards. Removed/promoted states and candidate-level promotion receipts exclude cards. Untouched legacy suitability remains unknown. |
| Second try and round entry | Due retry_scheduled and open round≥2 enter Second try by inherited retry_due_at. Stored retry1 displays upcoming Round2; activating it actually creates round2, and open2 reuses that task. This adds no new mastery or scheduling rule. |
| Priority and dates | Review first by due time; Second try next by retry due; New last by saved capture time; stable IDs break ties. Overdue days use full24h intervals. nextPracticeAt uses an actual future pending review/current retry date, or null. UI owners agreed null omits the date line and dates render in the browser's local timezone. |
| Read-only next and refresh | GET and same-path POST reuse one next service. POST applies existing session, Origin, JSON and64KiB byte safeguards.301 UUID exclusions are preserved; malformed/unknown fields and oversized bodies fail explicitly. Foreign/invalid/stale/answered hints cannot restore another task. Latest owned open/unanswered candidate tasks can resume even when a manually created round inherits a future retry date; current counts once, ordinary summary is unchanged. Owned pending Review/task pairs also restore without regeneration. Explicit Next omits hints. |
| Model-free material read | GET `/api/v1/practice/tasks/[taskId]` delegates to the existing owned immediate material repository, returning the accepted material contract. No activation, gateway resolution, model call or evidence write occurs in summary/list/next/material reads. Missing/foreign material returns the existing404 failure envelope. |
| Home recent3 and Saved filter | Recent videos aggregate all visible owned saves, order by latest saved timestamp and return up to3 distinct sources. A source created long ago but saved most recently beats101 newer-created sources. Practice/needs-analysis counts use the common pool. Saved's full needs-analysis query uses the same predicate with exhausted200-row pages; B owns its page/UI/API integration. |
| Analysis and processing cues | needsAnalysisCount counts saves, not marks: a visible ready non-video save needs analysis when at least one active mark lacks a valid card ID or exact compact JSON location/text identity. Tests cover two missing marks counting once and removed/recreated mark IDs still matching generated cards. Processing includes saved/resolving_source/organizing/failed, excludes unsupported/hidden bookmarks. |
| Defensive responses | All three route wrappers catch runtime configuration failures and return the standard retryable INTERNAL_ERROR JSON envelope with no-store. Repository errors propagate rather than becoming empty queues; every RPC output is schema-parsed. The typed Supabase RPC calls no longer use the initial temporary generic RPC cast. |

Public RPCs are `get_today_practice_summary`, `list_today_practice_items`, `get_today_practice_next` and `list_today_practice_videos`. Exact TypeScript signatures, entry shapes and single-owner boundaries remain in the frozen contract document. Minimal public queue DTOs contain no draft answers, situations, coaching or full attempt history. Group2's full single-candidate state service remains available for actual round/material behavior.

## New migrations and observed fixes

Only the controller-provided project `popcorn-phase1-groups24` on API54331/DB54332 was changed. Its wrapper validates project, ports and private environment-file permissions. CLI commands always use `--workdir /private/tmp/popcorn-phase1-test-stack`; no default-worktree reset/stop was run.

1. `202611010029_today_practice_queue.sql`: additive read functions and server-only ACLs, no table/backfill changes. Applied successfully to the dedicated stack. Once applied, this file was not edited.
2. `202611010030_today_exclude_validation.sql`: real SQL RED found `ARRAY[NULL]` made NOT(id=ANY(...)) unknown and silently hid every row. The new guard rejects it with22023; the same regression passed after applying030.029 was preserved.
3. `202611010031_today_candidate_schema_parity.sql`:10 new real SQL cases failed against029's first validator. Modern compatibility length, optional confidence/UUID/key types, null enum entries, segment whitespace, optional reason and unknown object fields were not fully aligned with CandidateExpressionSchema; the read validator also imposed a substring requirement absent from that schema.031 aligns selection with the existing schema, including Unicode whitespace/UTF16 bounds and strict optional metadata. It neither changes stored cards nor weakens generation's separate semantic checks. All10 cases then passed; matching TypeScript schema cases also pass. Existing v3 content already passes its stronger generation normalization. No runtime fallback or prompt change was added.

## Verification evidence

| Check | Result | Log |
| --- | --- | --- |
| Shared contract initial RED/GREEN | Missing module, then4/4 | `/private/tmp/group3-contract-red.log`, `group3-contract-green.log` |
| Domain/HTTP initial checks |11/11 | `/private/tmp/group3-domain-http-green.log` |
| SQL initial implementation | Missing functions RED, then initial schema checks GREEN | `/private/tmp/group3-sql-red.log`, `group3-sql-green.log` |
| SQL null-exclude fix | One real failing case, then GREEN after030 | `/private/tmp/group3-sql-expanded-red.log` |
| Historical-card schema parity |10 failures out of44, then44/44 | `/private/tmp/group3-schema-parity-red.log`, `group3-schema-parity-green.log` |
| Runtime failure envelopes | Four route failures RED, then6/6 integration tests | `/private/tmp/group3-route-envelopes-red.log`, `group3-route-envelopes-green.log` |
| Final own focused TypeScript |4 files29 tests PASS | `/private/tmp/group3-backend-focused-final.log` |
| Final domain+contract+integration regression |51 files939 tests PASS | `/private/tmp/group3-backend-regression-final.log` |
| Final full SQL suite |16 files890 assertions PASS; today suite50 | `/private/tmp/group3-backend-sql-final.log` |
| Whole-worktree typecheck | Exit0, no diagnostics | `/private/tmp/group3-backend-typecheck-final.log` |
| Own implementation/tests lint | Exit0, no diagnostics | `/private/tmp/group3-backend-lint-final.log` |
| Worktree whitespace check | `git diff --check` exit0 | Run after final source changes |

The full SQL run includes the accepted group2 lifecycle, nonempty legacy backfill, candidate promotion, source deletion, assistance and RLS regressions as well as the new queue suite. New SQL tests run within transactions and roll back. The retained-mark fixture initially omitted the existing mandatory removed_at timestamp; correcting that fixture preserved the existing constraint. No product implementation or assertion was loosened to pass it.

Representative commands:

```text
pnpm --config.verify-deps-before-run=false exec vitest run src/server/domain tests/contract tests/integration
pnpm --config.verify-deps-before-run=false typecheck
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py node_modules/.bin/supabase migration up --local --workdir /private/tmp/popcorn-phase1-test-stack
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py node_modules/.bin/supabase test db --workdir /private/tmp/popcorn-phase1-test-stack
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py node_modules/.bin/supabase gen types typescript --local --schema public,private --workdir /private/tmp/popcorn-phase1-test-stack
```

## Ownership and remaining acceptance

Owned paths: the new today contract/contract tests; learning-config estimate; new build-today-queue domain/tests, today-practice-http domain/tests, today-practice repository/runtime; today/next/material GET route files; generated types; migrations029–031; `supabase/tests/today_practice.sql`; `tests/integration/practice/today-practice.test.ts`; and the three group3 backend contract/preflight/report documents. B exclusively owns `features/saved/api.ts`; A did not edit it. C owns runner/Practice/Review extraction/Undo/summary; the controller owns seed/E2E/integration/release.

Exact21-file allowlist (also `/private/tmp/group3-backend-allowlist.txt`):

```text
src/contracts/today-practice.ts
tests/contract/today-practice.test.ts
src/server/domain/learning-config.ts
src/server/domain/build-today-queue.ts
src/server/domain/build-today-queue.test.ts
src/server/domain/today-practice-http.ts
src/server/domain/today-practice-http.test.ts
src/server/repositories/today-practice-repository.ts
src/server/today-practice-runtime.ts
src/app/api/v1/practice/today/route.ts
src/app/api/v1/practice/today/next/route.ts
src/app/api/v1/practice/tasks/[taskId]/route.ts
src/types/database.generated.ts
supabase/migrations/202611010029_today_practice_queue.sql
supabase/migrations/202611010030_today_exclude_validation.sql
supabase/migrations/202611010031_today_candidate_schema_parity.sql
supabase/tests/today_practice.sql
tests/integration/practice/today-practice.test.ts
docs/engineering/group-3-contracts.md
docs/engineering/group-3-preflight.md
docs/engineering/group-3-backend-report.md
```

No new product decision remains open for this backend scope. Explicit user/controller overrides remain: no generic runtime fallback, open first rounds restore as New, five-second Undo, no round cap, stable candidate-level dedup, maintained Review labels, and no fabricated next date. Existing mastery and schedule algorithms, Progress/Vault and group4 generation/scoring remain unchanged.

The controller separately verified the real seed twice with summary2 Review/1 Second try/3 New/12 minutes and15-table rowwise idempotence (`/private/tmp/group3-demo-live.log`); that is controller evidence, not an additional test performed by this implementer. Browser/E2E, the entire frozen-tree verify/build and separate acceptance of all **nine** section6.12 requirements remain the controller/designated D gate. SQL schema-parity logic must stay aligned with any future shared CandidateExpressionSchema change; paired TypeScript/SQL boundary cases protect the current schema.
