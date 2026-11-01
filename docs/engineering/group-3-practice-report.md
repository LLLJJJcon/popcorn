# Group 3 Practice implementation and self-test report

2026-11-01, Task 3C. Worktree `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-group3-confirmed`. This is the implementer's scoped verification record. Controller seed/browser integration and a different acceptance agent own the final Group 3 gate and all nine §6.12 checks. No commit, push, model call, personal database access, or personal app-port access was performed by C.

## Authority and ownership

Read the worktree AGENTS.md and installed Next 16.3.1 page, server/client, route, CSS and router/cache guides; the confirmed specification §1/3/5.2/5.13/5.14/6/15/16.3, current plan, Group 2 contracts/UI report and frozen Group 3 contracts. Implementation began only after controller released the isolated Group 3 branch and A published importable schemas. C used test-driven development, systematic debugging and verification-before-completion. Explicit controller/user decisions supersede generic fallback and stale preflight assumptions.

Owned changes are limited to Practice components/client API/CSS/tests, Practice pages and this report, plus the controller-authorized Practice UI assertions in `tests/integration/memory/vault-practice.test.ts`. C did not change Home, Saved, contracts, API routes, server domains/repositories, SQL, generated types, prompt modules, seeds or E2E files.

## Production paths

- `/practice` authenticates and reads A's common `service.today`; `TodayPractice` renders the exact subtitle, singular/plural summary, ordered group headings/counts/descriptions/anchors, expression/meaning/status rows and the first ten New items with `Show all {n}`. Reviews are never capped. A 101-Review/211-New regression covers full rendering and expansion.
- Individual Review links open `/practice/review/[reviewTaskId]?returnTo=%2Fpractice`. Candidate entry reuses an existing open task directly, or activates only the selected New/retry-scheduled item, then navigates to the existing task page with `returnTo=/practice`. Gateway/preparation failures retain the card and give settings or retry. The existing safe return-target whitelist remains intact.
- `/practice/session` authenticates and passes the owner ID to `TodaySession`. Every selection fetches fresh today data, intersects completed stable IDs with currently eligible IDs, then calls read-only POST next. Explicit Next does not send a resume hint. Full display history is never blindly sent as an exclusion payload; a 4,000-result history regression verifies the small request and continued selection. There is no product session/item cap.
- Initial/refresh hints contain stable current item/task IDs. A's server validates ownership/current/open/unanswered identity. The runner follows the server's returned item, handles a resumed manually created future round, and rejects material that became removed, promoted, superseded or answered between selection and material loading. Retry reads the current queue again. Listing and task-material GETs introduce no model calls.
- `PracticeSession` retains Group 2 first/revision/assistance/promotion behavior. Official first-answer conflicts now emit the authoritative completion once. Revisions emit no new completed item. New rounds keep the same item and left count, refresh only its material/hint, and replace the same result after another official first answer. Slow new-situation preparation gets the eight-second status and retries the same request ID after failure.
- Single-item `ReviewPractice` reuses existing due GET/POST, examples persistence, feedback and local rewrite comparison. `review-schema.ts` holds its client-safe validated DTOs. The retired local three-item queue, Continue and Stop implementation was removed; `due-practice.tsx` only reexports the single Review under the compatibility name. Group 4 generation/masking/regeneration/scored revisions are absent.
- Session feedback uses Next/Finish, with the last known remaining item using Finish. Remove emits its receipt immediately and advances. The runner retains a five-second Undo toast across the next item, respects the server deadline, restores the removed result/exclusion without replacing the current task and gives the restored item an opportunity to reenter. Standalone removal retains Group 2's five-second return behavior.

## Summary, lifecycle and safety

`session-storage.ts` validates version and owner, wraps every storage operation in try/catch, deduplicates stable IDs, and treats storage only as optional display/navigation data. It never supplies assistance, promotion, mastery or completion evidence to a write endpoint. Group 2 unsent-answer localStorage behavior remains; Review also retains an optional draft and keeps text after failed checks.

Each first-answer or Review result derives from the server response. Summary outcomes are Added to your Vault, actual Tried → Reused / Reused → Owned, Practice again tomorrow, Removed, or the controller-confirmed maintained-state line `Nice — still {state}. Next practice {local date}`. Maintained owned/reused results do not count moved up or display tomorrow. Summary totals are stable-ID based. Null nextPracticeAt omits the date line; real dates use the user's local formatting. Initial server-rendered Practice dates hydrate locally to avoid server/client timezone disagreement.

A display-only `finished` flag is set only when server next returns no item. Exit and Start continue an unfinished session. Once finished, a later Start with fresh server work clears the old result/exclusion/current hints before selection, including when the same candidate is due again. With no fresh work, the most recent finished summary remains visible. Old version-1 records without the new optional flag default to unfinished; no date rollover rule or scheduling change was added.

A real-component regression keeps exactly one main landmark and one h1 in New, Second try and Review sessions; embedded expression headings are h2 and have no duplicate workspace padding. Standalone first practice retains main/h1. Pending Review also uses a subordinate loading heading.

The delayed-response race found during preaudit was reproduced with a wrapper that renders the actual PracticeSession and holds real fetch responses. Next is disabled while an action is pending. Parent callbacks additionally capture the original stable item and task, validate active identity and operation sequence, and ignore unmounted responses. Late A new-round/answer callbacks cannot modify B's material, summary or navigation hint. Storage writes and Undo responses also stop after runner unmount. These guards preserve server evidence; they only reject obsolete client-side updates.

## Scoped requirement evidence

| Requirement | Implementer evidence |
| --- | --- |
| §6.2/6.4 exact descriptions, counts, singular/plural, statuses, Show all | `today-practice.test.tsx`: mixed counts, exact copy, Round 2/overdue, ten-item expansion, 101/211 items, open-first-round reuse and gateway handling |
| §6.5 ordered six-item session and Finish | `today-session.test.tsx`: 2 Reviews + 1 Second try + 3 New runs all six and ends with one summary; server next called after each item |
| Exit/restart/refresh/display history | runner and storage tests cover retained official results, validated initial hints, stale hint replacement, explicit Next without hints, 4,000-history compaction, version/user/corrupt/blocked storage and finished/new-work lifecycle |
| Same-item new round, revisions, Remove/Undo | Group 2 callback tests plus runner tests verify first-answer conflict, no new revision item, stable ID replacement, unchanged left, immediate advance and cross-item restore |
| Summary maintained/actual outcomes | runner owned-maintenance regression, stable-ID helper tests, null-date list tests and existing official promotion/first-answer tests |
| Standalone item return | candidate navigation assertions, Review link/back assertions and migrated Vault/Practice integration UI checks |
| Empty Practice/gateway/provider/slow preparation | list empty analysis action, null date, gateway settings; Review provider retained text/retry and slow gateway; first-practice slow-new-round idempotent retry |
| Concurrency and DOM | `today-session-concurrency.test.tsx` actual deferred round/answer responses; `today-session-dom.test.tsx` actual New/Second/Review components and standalone hierarchy |
| §6.7 Home and final §6.12 gate | B owns Home. Controller owns seed and browser E2E; D independently accepts the combined group. C makes no Home or final browser PASS claim. |

`tests/integration/memory/vault-practice.test.ts` now exercises the actual Today list entry instead of the retired three-item component. Its original owner scoping, public DTO, source evidence, canonical attempt history, tombstone and mastery checks remain. Old unit assertions that mandated a three-item cap or Continue/Stop were replaced with the specified flow; malformed/mismatched transfer/completion, retained answer, assistance reset and local-comparison negative checks remain covered in updated `due-practice.test.tsx`.

## RED → GREEN evidence

Logs are under `/private/tmp/`, contain fixture data only, and contain no user answer/key logging.

- `group3-c-first-red.log` → `group3-c-first-green.log`: two real missing callback/removal behaviors failed, then 21 tests passed.
- `group3-c-retire-red.log` → `group3-c-retire-green.log`: seven migrated single-Review tests failed against the old component interface; new Review and retained integration checks passed after retirement.
- `group3-c-slow-red-correct.log` → `group3-c-slow-green-correct.log`: missing eight-second new-round status failed, then 22 tests passed. An earlier test setup omitted the session Next callback and was corrected before this meaningful RED run.
- `group3-c-stale-red.log` → `group3-c-stale-green.log`: stale superseded material reopened before the fix; all removed/promoted/retry-scheduled/superseded variants passed afterward.
- `group3-c-dom-red.log` → `group3-c-dom-green.log`: three real session landmark/heading cases failed before the fix; four real-component checks passed afterward.
- `group3-c-lifecycle-red.log` → `group3-c-lifecycle-green.log`: a finished session wrongly excluded the same candidate's later work; 16 runner tests passed after the lifecycle boundary.
- `group3-c-concurrency-red-actual.log` → `group3-c-concurrency-green.log`: delayed round and answer responses corrupted current B before the fix; actual-component regressions and direct obsolete parent callbacks pass after identity/sequence/unmount guards.
- `group3-c-dedup-red.log` → `group3-c-dedup-green.log`: readable duplicate storage double-counted before normalization; stable-ID tests pass afterward.

New list/storage/runner modules initially produced missing-module test failures while scaffolding; these are not presented as behavior-specific RED evidence. The behavior-specific failures above were read and reproduced before their fixes.

## Initial frozen self-verification

Executed 2026-11-01 16:47 UTC, after all functional changes and the independent-preaudit fixes:

| Command | Result |
| --- | --- |
| `./node_modules/.bin/vitest run src/features/practice tests/integration/memory/vault-practice.test.ts` | **13 files, 109 tests passed**, exit 0 |
| `./node_modules/.bin/tsc --noEmit` | exit 0, no diagnostics |
| `./node_modules/.bin/eslint src/features/practice 'src/app/(app)/practice' tests/integration/memory/vault-practice.test.ts` | exit 0, no warnings/errors |
| `git diff --check -- src/features/practice 'src/app/(app)/practice' tests/integration/memory/vault-practice.test.ts` | exit 0 |

Exact logs: `/private/tmp/group3-c-final-tests.log`, `group3-c-final-types.log`, `group3-c-final-lint.log`, `group3-c-final-diff.log`. C did not run a competing full suite while B's full test run was active.

## Copy changes and remaining gate

Specified Group 3 copy replaces the retired Practice/3 due/about six minutes/Start practice/Continue/Stop/old empty links with Today's practice, the exact subtitle and grouped summary, Start, Next/Finish, Exit session, the required empty actions, final summary and completion buttons. The added `Your response` label preserves the submitted Review text when feedback replaces the form. The maintained Review summary line and null-date omission follow explicit controller rulings.

No scheduling/mastery/independence rule or production generic fallback was added. Standalone Group 2 navigation and idempotent round retries are preserved. The controller observed a repeatable Exit Link navigation failure and assigned C its diagnosis. The resolved finding and fresh verification are recorded below. Final combined Group 3 acceptance remains owned by the controller and separate acceptance agent.


## Exit hit-target diagnosis and correction, 17:00 Asia/Shanghai

The unchanged six-item browser test failed again after the initial freeze. C used the supplied trace and a temporary diagnostic copy under `/private/tmp/group3-c-exit-debug`; the repository E2E was not altered. Capture-phase native events showed pointerdown/mousedown/up/click targeting the adjacent H1, with no Exit-link event or cancelled navigation. At the same point the small inline Exit target had a nominal 22px rectangle; querying elementsFromPoint/layout reported the link. Thus the failure occurred at native hit targeting after scrolling, before Next Link routing. The browser-internal reason for the hit-test/layout discrepancy is an inference, not a proven Next router-cache defect.

One geometry-only hypothesis was tested in the temporary copy: make Exit an inline-flex target at least36px high and separate its line from the large title by12px. Native events then targeted the anchor and Next Link issued the normal `/practice` navigation; all six items passed. C applied only that confirmed geometry change as `.sessionExit` / `.sessionNavigation` in the runner/CSS. The existing Link, href, real click and URL/queue assertions remain unchanged; no forced navigation, event retargeting, test delay or SQL/evidence change was introduced.

The original repository command passed after the fix:

`python3 /private/tmp/popcorn-phase1-test-stack/with-test-stack.py python3 /private/tmp/popcorn-phase1-test-stack/run-web-e2e.py returning-learner.spec.ts --grep 'six real items' --trace on` → **1 passed,9.7s**. Log: `/private/tmp/group3-c-exit-original-green.log`. This used only reserved55-user fixture/API54331/DB54332/app3103, existing model fixtures and the test's own cleanup; C released the fixture for controller/D afterward.

Fresh post-fix scoped verification at16:59 Asia/Shanghai: **13 files,109 tests passed**, typecheck/lint/diff-check all exit0 with no diagnostics. Logs: `/private/tmp/group3-c-after-exit-{tests,types,lint,diff}.log`. Diagnostic native-event evidence is `/private/tmp/group3-c-exit-geometry.log`; the temporary single-variable hypothesis run is `/private/tmp/group3-c-exit-hitarea-hypothesis.log`. These logs contain reserved fixture text/public navigation information, no credentials.

## External promotion and Review completion races, 17:17 Asia/Shanghai

Controller and independent D found two continuity defects while reviewing701fa85: activation could return a Vault redirect after another tab promoted the selected candidate, and Group2's ALREADY_PROMOTED handler could leave a continuous session. C reproduced activation redirect, actual first-answer409 and actual new-round409 with deferred HTTP responses: **three failures before the fix** (`/private/tmp/group3-c-promotion-red.log`). Session mode now clears its obsolete current hint and reads the server's next item, retaining only official outcomes already recorded in this session. It never manufactures Added from another tab. Standalone candidate entry and standalone ALREADY_PROMOTED still open the existing Vault detail. The new callback captures the original item/task, and old/unmounted A responses or callbacks cannot advance B.

D also identified Review GET/POST conflicts after another tab completes the Review. C verified the actual public wire mapping: domain NOT_FOUND is HTTP404/FORBIDDEN; domain REVISION_CONFLICT is HTTP409/CONFLICT (`practiceErrorResponse`). No server or contract enum was changed. Client errors now retain HTTP status. Only a session Review with one of these exact status/code pairs asks for fresh, authenticated today data. It advances only if that Review is absent from the full eligible list. If the Review is still eligible, the confirmation read fails, or the original error is provider/network/503, its current material/text and error/retry path remain. Standalone Review error handling is unchanged. A valid same-answer201 receipt replay remains a normal official completion.

The real-wire Review regressions produced **four failures before the fix** (`/private/tmp/group3-c-review-wire-red.log`). Afterward actual Review GET404/POST409 continue to B without an A outcome; still-eligible404/409 and503 retain the answer/retry; standalone errors stay local; same-answer201 replay completes normally; late A conflict, obsolete callbacks and a delayed fresh-list confirmation cannot navigate, record or advance B. Confirmation and callbacks are checked against mounted state, original item/review identity and the active operation sequence. The tests render the actual PracticeSession/ReviewPractice behind observation wrappers rather than replacing their HTTP/error behavior with callback mocks.

Fresh final scoped verification at17:17 Asia/Shanghai: **13 files,123 tests passed**, with typecheck, targeted lint and diff-check all exit0 and no diagnostics. Logs: `/private/tmp/group3-c-promotion-review-final-{tests,types,lint,diff}.log`; focused GREEN evidence is `/private/tmp/group3-c-promotion-green.log`, `group3-c-review-race-green.log` and `group3-c-review-race-extra.log`. The existing standalone Vault redirect test remains green.

This repair changes only Practice client/component code, its tests and this report. No SQL, server/domain/evidence/schedule/mastery behavior, prompt, E2E assertion or fallback was changed, and C made no commit/push/model call. Controller was asked to rerun the unchanged mixed browser flow after this final navigation repair; C did not occupy its reserved55 fixture. D owns the new frozen-diff acceptance gate.
