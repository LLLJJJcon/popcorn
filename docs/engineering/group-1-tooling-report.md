# Group 1 tooling implementation and self-test report

Date: 2026-11-01. Role: task C implementer; this report is self-test evidence, not independent acceptance. No commits or pushes were performed by this role. No real-model calls were made.

## Changes

- `scripts/seed-demo.ts`: four additional saves cover automatic highlight success, an empty suggestion result, unavailable/fallback, and a basic-word `not_expression` card. Three highlights include analyzed and unanalyzed marks. The original three-state mastery/evidence/review graph remains unchanged. IDs include the exact owner and stable fixture names. Reruns insert only missing rows, preserve existing edits/mastery/schedules, and complete newly created review placeholders only when that review did not already exist. Modern cards include the runtime's location/text `highlightIdentity`, so a recreated mark with a new row ID still matches its original card.
- Two six-case JSON datasets under `tests/prompt-golden/` reproduce every prescribed input and expectation in sections 8.1 and 8.2. Tests freeze the verbatim task text using digests of the approved specification, verify isolation framing and JSON inputs, exercise valid/invalid normalizers, and validate each deterministic fixture output. A fixture's prescribed mechanical text is explicitly **not** treated as evidence that a real model meets semantic expectations.
- `scripts/try-prompts.ts` and `pnpm prompts:try`: requires an explicit version, `--real`, and an existing owner's UUID before reading configuration or doing network work. Resolves that owner's active gateway with the existing resolver and transport. Local dotenv is parsed as data; credentials/configuration/provider errors are never printed. Reuses the launcher's proxy-origin validation and child environment derivation, including startup-time Node proxy activation and loopback bypass. Selected sample inputs, expectations, bounded outputs, mechanical comparisons, and outstanding human-review criteria are appended to `docs/engineering/prompt-runs/<UTC-date>-<version>.md`. One request per selected case makes initial failures visible; existing transport retries remain unchanged. This is an explicit developer review tool, not a new product invocation point.
- `package.json`: `test:prompts` runs the golden/tool tests and is included in `pnpm test`, hence `pnpm verify`; `test:extension` now runs **all** `extension/tests/*.test.js`, including save-payloads.
- `saved-learning-loop.spec.ts`: browser selection → Mark POST → Analyze v3 registration → existing analysis handler and transactional persistence with the deterministic gateway → learning-card layout → remove/Undo/reload → original Practice/revision/Vault/due Practice/Progress regression. Candidate selectors are scoped to the active saved item. Selection waits for the initial owner-bound candidates GET, proving editor hydration before a synthetic browser Range/mouseup.
- `returning-learner.spec.ts`: retains the existing layout and due-Practice regressions, adds a cached v3 card with a stable location/text key, verifies marks/default fields/tags/More, and cleans up the added artifact. Save count, mastery change, completion, and next-review assertions remain intact.
- `tests/e2e/group-one-fixtures.ts`: processes only the exact reserved saved-loop owner/job with the existing production handler, persistence adapter and fixture gateway. It never calls the global queue-claim endpoint, so unrelated local users' queued jobs are not consumed. The fake consenting gateway model equals the fixture's model, preserving existing SQL configuration/model checks. Reserved fake Vault secret cleanup handles interrupted reruns.

## Test evidence

| Command / stage | Observed result | Log |
| --- | --- | --- |
| Added seed coverage, before implementation | RED: 1 failed, 28 passed | `/private/tmp/group1-tooling-seed-red.log` |
| Golden/extension command coverage before package change | RED: full-extension script expectation failed; 22 existing prompt tests passed | `/private/tmp/group1-tooling-prompts-red.log` |
| `pnpm exec vitest run tests/prompt-golden tests/integration/demo/demo-seed.test.ts tests/contract/e2e/saved-learning-loop-cleanup.test.ts` | GREEN: 4 files, 63 tests passed | `/private/tmp/group1-tooling-tests-final.log` |
| `pnpm test:extension` | GREEN: 180 passed, 0 failed, 0 skipped | `/private/tmp/group1-tooling-extension.log` |
| `pnpm typecheck` | GREEN, exit 0 | `/private/tmp/group1-tooling-typecheck-final.log` |
| Focused ESLint over all C scripts, E2E, golden and seed test paths | GREEN, exit 0 | `/private/tmp/group1-tooling-lint-final.log` |
| `git diff --check -- scripts package.json tests/e2e tests/prompt-golden tests/integration/demo/demo-seed.test.ts` | GREEN, no whitespace errors | command output empty |
| `pnpm prompts:try -- highlight-expressions-v1` without opt-in | Expected exit 1 and fixed usage message, before configuration/network access | `/private/tmp/group1-tooling-cli-optin.log` |
| Both specified E2E files against isolated fixture service | GREEN: 4 passed (32.7s) | `/private/tmp/group1-tooling-e2e-final.log` |

The added stable-key and proxy checks were first run against already corrected implementations and reported GREEN; no false claim of prior RED is made. The original prompt builder/normalizer behavior was already correct when task C began (backend agent supplied those exports).

## E2E diagnosis and environment

The original saved-loop failure was a raw-text selector matching both the active save and an ignored moment resolved to the same line. Scoping to `#saved-item-<id>` fixes the test. The original returning learner 409 does not reproduce on a dedicated service started with `CI=true` and fixture mode; its original due-completion step returned 201 there. No product decision or Practice/mastery rule was modified to satisfy these tests.

The current isolated app copy is `/private/tmp/popcorn-group1-tooling-e2e`. It contains copies of `src`, `public`, package/Next/TypeScript/PostCSS configuration and a symlink to this repository's `node_modules`. **No `.env` file was copied.** Service credentials are loaded from the repository's existing `.env.local` into the child environment in memory. Latest source sync before final self-test: 2026-11-01, test-log time 13:38 (source files were copied in place). Test files are read directly from the original workspace.

The service listens on **127.0.0.1:3101**, with `APP_URL=http://127.0.0.1:3101`, `CI=true`, and `POPCORN_PROVIDER_MODE=fixtures`. Managed exec session: **22266**. Its own `.next` is in the temporary copy; existing port 3000 and the workspace `.next` were left untouched. The initial restricted listen attempt failed with `EPERM`; managed approval allowed the local test listener and database/browser access.

A temporary `/private/tmp/popcorn-group1-tooling-e2e/playwright.config.ts` imports `defineConfig` from `@playwright/test`, sets the original workspace's `tests/e2e` as `testDir`, matches `(saved-learning-loop|returning-learner)\.spec\.ts`, uses one worker, 60-second test timeout, 10-second assertion timeout, base URL `http://127.0.0.1:3101`, output directory `/private/tmp/popcorn-group1-e2e-results`, and **omits** `webServer` so it reuses this dedicated service without starting or querying port 3000.

Re-run from the repository with local environment access (do not run overlapping instances of these owner-reserved suites):

```sh
APP_URL=http://127.0.0.1:3101 POPCORN_PROVIDER_MODE=fixtures \
  node --env-file=.env.local node_modules/@playwright/test/cli.js test \
  -c /private/tmp/popcorn-group1-tooling-e2e/playwright.config.ts
```

Set `POPCORN_E2E_DATABASE_URL` in the execution environment to the existing local Postgres connection before running; never print it. Cleanup is restricted to reserved identities `52000000-0000-4000-8000-000000000001` and `53000000-0000-4000-8000-000000000001`, guarded against an unexpected email. No database reset was run. The final test runner supplied the already-known local connection in memory; it did not write connection details to files.

The service is intentionally left running for independent acceptance. To stop **only this** service after acceptance, first verify the listener with `lsof -nP -iTCP:3101 -sTCP:LISTEN`, then send `TERM` to that verified process ID. Do not use a broad `pkill` or stop the existing service on port 3000.

To restart, refresh the isolated source/config copies and launch the installed Next entrypoint in that temporary directory with the same child environment. Load `.env.local` with Node's `--env-file` from the repository, override `APP_URL`, `CI` and fixture mode for the child, and spawn `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101 --webpack` with `cwd` set to the isolated copy. Do not copy secrets into that directory.

## Remaining review

- Real-model semantic quality remains **unrun and unaccepted**. Product review can explicitly invoke `pnpm prompts:try -- <version> --real --user <existing-owner-UUID> [--case <case-id>]`, then inspect the generated comparison report and human-review criteria. This task did not authorize spending real calls, so no real prompt-run report was fabricated.
- Independent acceptance owns the final integrated lint/unit/contract/integration/provenance/build/SQL/E2E gates. The temporary service uses development mode; the installed Next guide recommends a production build for release verification. This self-test does not replace that production build or independent review.
- Group 2–4 behavior and section 4.9 downstream integrations were not implemented by task C.
