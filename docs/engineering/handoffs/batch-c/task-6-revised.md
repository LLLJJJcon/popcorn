# Batch C Revised Task 6 Handoff

## Scope

Controller implementation from baseline `11b5980` in
`/private/tmp/popcorn-youtube-learning`.

Changed only the Task 6 brief/handoff, the exact `chromium-web` Playwright
matcher/server command, and one deterministic returning-learner E2E. No
application, extension, database, shared-contract, dependency, lockfile, or
Provider code changed.

## RED evidence

After adding `tests/e2e/returning-learner.spec.ts`, the unchanged Web project
did not select it:

```text
node_modules/.bin/playwright test tests/e2e/returning-learner.spec.ts \
  --project=chromium-web --list
Error: No tests found.
Total: 0 tests in 0 files
```

The matcher was then minimally extended to the two named Web learning-loop
files. Collection became exactly one test in the new file.

The first executable run exposed an environment-specific pre-test failure:
Next 16 Turbopack rejected this integration worktree's dependency symlink as
outside its filesystem root. A direct `next dev --webpack` startup reached
Ready, confirming the root cause. The E2E-only server command now adds
`--webpack`; production code and build configuration are unchanged.

The next run reached the scenario and exposed a real cleanup RED after due
completion: the completed review, generated due task, and attempt form a
foreign-key cycle. Running the exact fixture SQL directly produced
`practice_task_review_owner_fk`. Cleanup now removes the fixture receipt and
mastery event, converts only this reserved user's completed review to the
valid cancelled/null shape, then deletes attempts, practice tasks, and reviews
in dependency order. The exact cleanup subsequently committed successfully.

## GREEN behavior

The independent fixed fixture contains:

- one existing YouTube save;
- one source-grounded expression with an old independent original attempt and
  `tried` mastery;
- one fixed overdue review; and
- no model gateway configuration or API key.

The browser signs in with the local password fixture, observes initial
Progress, starts a newly generated due transfer, submits
`这个票价也太离谱了吧！` without assistance, and observes
`tried -> reused`. Afterward Progress shows one weekly attempt, one due
completion, one independent reuse, zero currently due reviews, and mastery
distribution Tried 0 / Reused 1 / Owned 0. The owner-scoped saved-item count is
one both before and after.

CI uses `createEvaluationFixtureGateway`; the scenario makes no real Provider
call and reads no user API key.

## Candidate gate evidence

- Returning-learner Chromium: 1/1 passed in 14.5 seconds after cleanup repair.
- Batch C scoped Vitest: 8 files, 59/59 passed.
- Extension recovery/queue/restart: 27/27 passed.
- TypeScript: exit 0.
- Scoped ESLint for the new E2E and Playwright config: exit 0.
- Next webpack production build: exit 0, 24/24 pages generated.
- `git diff --check`: exit 0.

Full pgTAP was intentionally not repeated. `CONTRACT-015` retains its accepted
624/624 evidence and `CONTRACT-016` retains its clean-reset 657/657 evidence;
Task 6 changes neither database contract.

## Upstream and licensing

YouTube Digest remains pinned to
`zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`
under MIT. Task 6 changes no upstream-derived file or function and only reruns
the accepted extension recovery suite. LLM Wiki
`nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6`
was not used; no GPLv3 code, test, prompt, component, or asset was copied.

## Remaining risk

The local E2E requires Supabase on ports 54321/54322, `psql`, installed
Playwright Chromium, and a server launched with `CI=true`. These are explicit
local test prerequisites, not runtime requirements for an already installed
personal instance. Independent full Batch C review is still required before
the controller freezes `gate-c.md` and the ledger.
