# Group 3B Home and Saved implementation report

2026-11-01. Implementer: `/root/group3_home`. Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-group3-confirmed`. No commits, pushes, contracts/backend/SQL edits or independent acceptance were performed by this implementer.

## Scope and interface

Read AGENTS.md, the installed Next16 server/client-components and async page searchParams guides, confirmed specification sections1/3/5.2/5.13/5.14/6/15/16.3, the implementation plan, accepted group2 contracts and actual group3 frozen contracts. Used the prescribed TDD workflow. Controller owns integration and a different agent owns acceptance.

Home now consumes `today.home(userId, now)` from A's `createTodayPracticeService(createTodayPracticeRepository(client))`. Its `HomeView` exposes `summary`, `recentVideos`, `hasActiveGateway` and the unchanged mastery distribution. It no longer reads legacy `saved.home`, `saved.list`, or Progress's due count to infer today's queue. A owns the full counts, latest three distinct visible videos, qualification predicates and query pagination; B neither truncates nor reclassifies these results.

Saved recognizes only string `filter=needs-analysis` after awaiting searchParams and uses `createTodayPracticeRuntime().service.needsAnalysisVideos(userId, now)`. It does not filter the legacy bounded Saved array or approximate analysis eligibility with processing status. A supplies the full qualified list. Unknown/multivalued filters preserve the existing full library behavior. Both branches authenticate before data reads.

## Delivered behavior and coverage

| Requirement | Implementation / test evidence |
| --- | --- |
| Gateway → queue → analyze → YouTube | `home-runtime.test.ts` checks gateway precedence, mixed2/1/3, pure New, pure Second try, qualified analysis and processing-only fallback. Queue action links directly to `/practice/session` and uses server estimatedMinutes. |
| Same full summary | Home loader test retains101 Reviews+1 Second try+201 New /606minutes even when Progress reports1 due; private gateway fields never enter HomeView. |
| Three zero-inclusive cards | `home-today.test.tsx` checks literal6.2 copy, counts, exact anchor destinations and gray empty classes. Implementation imports A's `TODAY_PRACTICE_GROUPS`; descriptions are not copied into production Home. |
| Secondary processing/failed cue | Home uses A's combined `processingCount` only in the secondary line `{p} saves are still processing`, following the exact confirmed copy. The server contract includes failed saves in that number. No new processing-status approximation exists in Home. |
| Mastery retained | Existing Tried/Reused/Owned distribution and supporting text remain; `View Progress` is an outlined secondary button. |
| Recent3 | Accessible compact list renders the ordered A-supplied videos, source links, per-video practice count or needs-analysis count (saved-moment fallback for0/0), local latest activity, and bottom `View all Saved videos` secondary button. Three-item rendering covered in Home tests. Full latest-source ordering/dedup and aggregation remain A's repository/SQL tests. |
| Local dates / hydration | Tiny client `LocalDate` uses `useSyncExternalStore` to serve the same stable placeholder during SSR and initial hydration, then browser-default Intl formatting. Test simulates America/Los_Angeles across a UTC date boundary and verifies actual local date, real hydration with zero recoverable errors, and retained datetime attribute. Null nextPracticeAt omits the date line. |
| Saved URL/local filters | Existing All/Ready/Processing interactions remain covered. Qualified mode has a Needs analysis label and All link to `/saved`; its empty message does not claim the whole library is empty. Tests catch a retained Processing filter hiding qualified ready videos and round-trip navigation returning All with a stale selection. Qualified mode bypasses local processing filters, and page keys reset state when switching URL modes. |
| Earlier Saved states | All existing Saved unit and owner-scoped integration suites pass in the affected run. The Saved API edit removes only the retired home interface/service forwarding/repository count implementation; candidate/practice-state aggregation and timeline/detail behavior remain intact. |

## RED → GREEN evidence

- Initial Home tests:10 failed /3 passed, as expected: old selector ignored all new queue fields, old loader expected saved.home/list, and old UI lacked counters/recent3/local next date.
- SavedLibrary additions:2 failed /4 passed before qualified-mode rendering existed.
- SavedPage addition:1 failed /4 passed before URL query wiring; the old page rendered Full library video for needs-analysis.
- Stale local Processing→qualified result regression:1 failed /6 passed before bypassing local status filters in qualified mode.
- Round-trip All→Processing→needs-analysis→All regression:1 failed /5 passed before distinct page keys reset the local tab state.
- Final affected run: **21files /127tests PASS**, exit0. Log: `/private/tmp/group3-home-focused.log`.
- Scoped ESLint on all changed Home/Saved/page/integration files: **exit0**, no warnings. Whole TypeScript `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **exit0** after the final navigation fix.
- Initial full project test command, through the approved isolated wrapper: **exit0**, unit596 +contract216 +integration556 +prompts48 =**1416 PASS**, at the shared branch snapshot available then. Log: `/private/tmp/group3-home-full-test.log`.
- Final full-project rerun after the navigation fix: **exit0**, unit597 +contract216 +integration556 +prompts48 =**1417 PASS**, with no failing suite. Log: `/private/tmp/group3-home-final-project-test.log`. Other owners continue working concurrently, so this is not the independent frozen group3 gate. Final B diff whitespace check also exits0.

Commands:

```text
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false exec vitest run src/features/home src/features/saved 'src/app/(app)/saved/page.test.tsx' tests/integration/saved --reporter=dot
python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py env CI=true POPCORN_PROVIDER_MODE=fixtures pnpm_config_verify_deps_before_run=false pnpm --config.verify-deps-before-run=false test
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

All tests use fixture mode and the controller-provided isolated environment (API54331 /DB54332). No real model request, personal dotenv/database, or personal port3000 was used. Direct initial `pnpm exec` attempted its dependency pre-run check and failed on a temporary-file permission before tests ran; subsequent commands disable that automatic check and do not install or change dependencies.

## Exact changed-file allowlist

```text
docs/engineering/group-3-home-report.md
src/app/(app)/saved/page.tsx
src/app/(app)/saved/page.test.tsx
src/features/home/home-dashboard.module.css
src/features/home/home-dashboard.test.tsx
src/features/home/home-dashboard.tsx
src/features/home/home-runtime.test.ts
src/features/home/home-runtime.ts
src/features/home/home-view.ts
src/features/home/home-today.test.tsx
src/features/home/local-date.tsx
src/features/home/local-date.test.tsx
src/features/home/next-action.tsx
src/features/saved/api.ts
src/features/saved/saved-highlight-material.test.ts
src/features/saved/saved-library.test.tsx
src/features/saved/saved-library.tsx
src/features/saved/saved-timeline.test.tsx
tests/integration/saved/extension-library-route.test.ts
tests/integration/saved/video-library.test.ts
```

The extra existing Saved test edits only migrate obsolete HomeView fixtures or remove the retired repository.home mock. No Practice components/pages/styles, shared contracts, queue predicates, SQL, generated types, seed, E2E or integration ledger files were changed by B.

## Limits and remaining group work

No product rule deviation. Supplemental UI copy covers per-video counts and the empty Needs analysis filter. `nextPracticeAt=null` omission follows the frozen contract. Date placeholders are intentional until browser mount; no server timezone is presented as the user's timezone.

This report is implementer evidence only. Real SQL count/filter/latest3 behavior, seed data, production build/browser layout/E2E and independent acceptance of all nine section6.12 items remain the controller/A/C/designated D responsibilities. No live-model semantic quality is claimed. No known B-specific failure remains after the focused run.
