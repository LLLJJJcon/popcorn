# Group 1 independent acceptance — 2026-11-01

## Decision and independent role

**Confirmed group 1 behavior and automated engineering/fixture gates: PASS. Full release completion: pending the migration-021 whitespace exception and the controller's final process records.** Real-model semantic quality was not run and is not represented as accepted.

The acceptance agent `/root/acceptance` did not implement or fix product, seed, prompt, test, migration or configuration changes. Backend, Saved UI and tooling were implemented by different agents. Findings were returned to the controller and original implementer; this agent only ran independent checks and wrote this report.

Initial integrated freeze: `aa8ec40f8325c18f269bfee3e07ffa5268c2e396`. The subsequent freeze `dd94c621dc2e2c7147b578f2cc2b5de6cf08c55f` changes only the obsolete provenance test expectation and the tooling report. Final whole-range review covers `ab9737f..dd94c62`, including the original implementation checkpoint `4f61021`, backend/UI checkpoint `2179245`, and tooling checkpoint `aa8ec40`.

Tests ran from fresh `git archive` copies at `/private/tmp/popcorn-group1-acceptance-aa8ec40` and `/private/tmp/popcorn-group1-acceptance-dd94c62`, with the existing `node_modules` symlinked. A temporary empty Git repository supplies ignore-rule inspection for provenance tests. No secret dotenv file was copied; the committed `.env.example` is the only environment file in either archive. Existing local settings were loaded into child-process environments without printing their contents. Node: `v24.13.1`; pnpm: `11.25.0`; installed Next.js: `16.3.1`.

The main workspace concurrently acquired unassigned changes in `src/server/ai/openai-compatible-provider.ts` and `tests/integration/model-gateway/structured-json-gateway.test.ts` concerning Haiku thinking/token handling. They were preserved and excluded from the tested archive and this acceptance decision. The ordinary generated `next-env.d.ts` workspace change is likewise not part of the freeze. No broad workspace result is substituted for a frozen-version result.

## Commands, counts and exit status

All commands below used the frozen archive as their working directory. `CI=true` and `POPCORN_PROVIDER_MODE=fixtures` were set for web verification. Local-port, database and Chromium access were allowed where required. No database reset or real-model trial was run.

The exact E2E invocation was `node node_modules/@playwright/test/cli.js test -c playwright.acceptance.config.ts`. That temporary configuration matches only `(saved-learning-loop|returning-learner)\.spec\.ts`, uses one worker, has no `webServer` entry, and points to `http://127.0.0.1:3102`. The server invocation was `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102` after the frozen production build. `POPCORN_E2E_DATABASE_URL` came from the existing local Supabase connection in the test process environment; its value is intentionally omitted.

| Gate | Independent result | Evidence |
| --- | --- | --- |
| `pnpm verify` at aa8ec40 | Exit 1: only one stale provenance assertion failed; its expected four-test extension command conflicted with the required complete suite | `/private/tmp/popcorn-group1-final-verify-aa8ec40.log` |
| `pnpm --config.verify-deps-before-run=false verify` at dd94c62 | **Exit 0**; also inherited `pnpm_config_verify_deps_before_run=false` to prevent automatic dependency installation in a symlinked archive; no tests were skipped | `/private/tmp/popcorn-group1-final-verify-dd94c62.log` |
| Included lint | Exit 0; 0 errors and 4 existing unused-variable/import warnings | Same final verify log |
| Included typecheck | Exit 0 | Same final verify log |
| Included unit tests | 53 files, **483 passed**, exit 0 | Same final verify log |
| Included contract tests | 6 files, **186 passed**, exit 0 | Same final verify log |
| Included integration tests | 28 files, **525 passed**, exit 0 | Same final verify log |
| Included prompt golden/tool tests | 2 files, **28 passed**, exit 0 | Same final verify log |
| Included provenance tests | 2 files, **16 passed**, exit 0 | Same final verify log |
| Included production build | Exit 0; compiled and generated all 25 static pages | Same final verify log |
| `pnpm --config.verify-deps-before-run=false test:extension` | Complete `extension/tests/*.test.js`: **180 passed**, 0 failed/skipped, exit 0 | `/private/tmp/popcorn-group1-final-extension-aa8ec40.log` |
| `pnpm exec supabase test db` | All **13 files / 736 assertions passed**, exit 0; existing local migrations through 023, transactional rollback tests | `/private/tmp/popcorn-group1-final-sql-aa8ec40.log` |
| Both required E2E files via the frozen copy's temporary Playwright config | **4 passed**, exit 0, against the frozen production build on `127.0.0.1:3102` | `/private/tmp/popcorn-group1-final-e2e-aa8ec40.log` |
| `git diff --check ab9737f dd94c62` | **Pending disposition:** reports a new blank EOF line in applied migration 021:216 | Controller has requested an explicit exception before any change to this applied migration |

The first complete-extension invocation encountered pnpm's automatic install check refusing a symlink target outside the temporary root. Re-running with dependency prechecking disabled ran the full unchanged test script. This was an archive/runtime restriction, not an extension failure. The first baseline integration run also required allowed loopback listening; the unrestricted baseline and both frozen full verification runs passed.

The original baseline SQL failure at the historical 200-UTF-16 expression boundary was reconciled with migration 022's existing 10000-unit compatibility bound; the final full SQL suite passes. The original E2E duplicate raw-text selector and due-completion 409 no longer reproduce with scoped selectors and a dedicated fixture service. Practice/mastery behavior was not changed to satisfy those tests.

## Section 4.13 acceptance matrix

PASS below means engineering behavior established by deterministic tests, real local database transactions, browser tests and reviewed source. It does not assert that a live model has passed semantic review.

| # | Confirmed criterion | Result and concrete evidence |
| --- | --- | --- |
| 1 | Automatic marks after saving a line containing 高得要命; rationale on hover | **PASS.** `highlight-saved-item.test.ts`: `valid suggestion only references target and server-computed offsets`; `expression_highlights.sql`: gateway-enabled ready transition queues exactly one suggestion, completion publishes ready. `highlight-editor.tsx` renders model/user marks identically and places `reasonEn` in the native `title` tooltip. No real-model selection-quality claim. |
| 2 | Saved selection becomes a user mark without a model call | **PASS.** `expression_highlights.sql`: exact joined UTF-16 selection becomes one per-line-endpoint user mark; ready replay does not duplicate it. Extension `save-payloads.test.js` covers cross-line selected text and actual Save handlers. The snapshot trigger's selection/explanation branches return before gateway resolution. |
| 3 | Player N-save with panel closed resolves/persists the correct line, previous line in gaps, 3-before/2-after context | **PASS.** Extension player-moment capture tests; `saved-item-target.test.ts` and `saved-highlight-material.test.ts` cover gaps/first-line fallback and persisted target precedence. `expression_highlights.sql` checks resolved moment payload and context bounds. This uses composed automated coverage; no manual YouTube session is claimed. |
| 4 | Four invalid-JSON calls lead to usable unavailable fallback and retry/setup action | **PASS.** `invalid model JSON calls four times then persists unavailable`; editor pending/empty/fallback/setup tests; `switches Suggest again to setup if the gateway was removed after loading`; target text remains editable. |
| 5 | Five-second Undo; consecutive and cross-line marks; new overlapping selection replaces old marks | **PASS.** Editor tests `expires undo after five seconds`, `submits a trimmed Mark and retains both marks after consecutive additions and reopening`, `replaces overlapping marks with the server-confirmed cross-line selection`. SQL confirms soft deletion, overlap replacement, valid Undo and expired rejection. Saved-loop browser test removes, restores and reloads its persisted mark. |
| 6 | Analyze generates one bounded card per mark, exact-expression examples and tags | **PASS.** `marked-learning-cards.test.ts` covers grounding, 5+1 batches and `450 * count + 150` budgets; v3/golden tests cover required fields, 40-word/30-character limits and exact-mark examples. `learning-card.test.tsx` covers tags/default/More layout. Saved-loop E2E performs a real Mark POST, Analyze registration, production analysis handler with fixture gateway, transactional artifact persistence and rendered card checks. |
| 7 | One repeatedly invalid mark does not discard other cards; targeted retry | **PASS.** `retries only bad cards and preserves successful cards when one mark keeps failing`; `keeps successful cards alongside a failed mark and retries only that mark`; `recovers failed mark states after a full-page refresh`. Shared JSON/card budget and examples-only fallback tests pass. |
| 8 | Removing an analyzed mark keeps its card; repeated Analyze does not duplicate it | **PASS.** `grounds every card in its selected mark and skips previously analyzed positions`; `keeps Analyze disabled for an already analyzed location even after a mark gets a new id`; body-free Analyze/card-preservation UI test; aggregate SQL merge tests; saved-loop browser remove/Undo/reload. Demo and returning-learner seeds now include `highlightIdentity` keys; the seed test constructs a recreated mark ID and confirms it matches the original card. |
| 9 | A name/non-expression card explains the classification and offers Practice anyway | **PASS.** `keeps a not-expression choice actionable and handles unavailable examples` renders the name reason and `Practice anyway`; normalizer/golden tests require a reason for `not_expression`; the demo includes a basic-word non-expression card. Live-model name classification remains semantic review. |
| 10 | No old ±30-second/12-line analysis evidence; legacy analysis remains readable | **PASS.** Reviewed `readSavedItemAnalysisEvidence` uses authoritative target segments plus 3-before/2-after. Source/target tests cover the bounded window. `candidate-list.test.tsx` explicitly runs readable v1/v2 cases; legacy cards retain the older-version notice and original presentation. |
| 11 | Required existing analysis/UI/extension regression tests updated and passing | **PASS.** Full unit run includes `analyze-saved-item.v1.test.ts`, `candidate-list.test.tsx`, `saved-video-detail.test.tsx`; complete extension command includes all 29 save-payload tests. Both required E2E suites pass against the isolated production fixture service. |

## Sections 8.0–8.2 and invariants

- **PASS — exact task text:** independent extraction of the specification's 8.1/8.2 fenced instructions matched the implementation constants character-for-character (2042/3567 characters); golden tests freeze their SHA-256 digests. The isolation prefix, blank-line separator, JSON user data and final user-data instruction are checked. Analyze's erroneous expression-selection instruction is absent.
- **PASS — versions/fixtures/golden integration:** old v1/v2 remain readable; each new prompt exports its own deterministic fixture. Both six-case datasets are present, malformed/valid shapes are exercised, and `pnpm test` includes `test:prompts`, hence CI's `pnpm verify` executes them.
- **PASS — retry/token/field rules:** centralized `FORMAT_RETRY_MAX=3` and `ANALYZE_BATCH_SIZE=5`; four format attempts, partial success, examples-only fallback, short IDs and ordered associations; 350/20000 highlight parameters and per-batch analysis budgets; enum cleanup/fallbacks. Transport retries are unchanged. Modern generated candidates omit confidence; legacy reads and the internal occurrence compatibility value survive migration 023.
- **PASS — permissions/evidence/atomicity:** authenticated owner-scoped HTTP handlers and Origin checks; server-derived UTF-16 text/bounds; owner RLS and service-only mutation RPC; save-row locking, stale lease fences, no resurrection by late model suggestions, atomic card publication and idempotent promotion receipts. Full SQL includes highlight, learning-card, promotion, due-completion, source-deletion and RLS regressions.
- **PASS — product scope:** no group 2–4 behavior, new mastery/independence rules, altered 1/7/30-day schedule, Vault filters, draft or phase-2 functionality was introduced in the reconciliation. Existing long-selection compatibility projections carry cards into current practice and promotion without changing learning decisions.
- **PASS — real-call tooling boundary:** CLI requires explicit `--real` and owner UUID before configuration/network work, resolves the owner's existing local gateway, reuses validated proxy handling and omits provider error details. No real calls were made. Mechanical fixture checks are explicitly separate from semantic acceptance.

## Section 15.4 and remaining release work

| Requirement | Status |
| --- | --- |
| Four execution-preflight checks documented with evidence and impact | **PASS:** `optimization-preflight.md` |
| Every section 4.13 criterion mapped to evidence | **PASS:** matrix above; controller can reuse it in the PR description |
| Relevant unit/integration/SQL and both required E2E suites | **PASS:** fresh independent results above |
| Extension filter includes new save tests | **PASS:** full extension command and 180 passing tests |
| Group execution ledger and final GitHub/PR acceptance evidence | **Controller-owned finalization:** append this independent result, preserve remaining limitations, and save/push the report. A branch checkpoint alone is not an actual PR description; no PR was created by this role. |
| Required full-range whitespace CI check | **Pending:** applied migration 021 EOF exception; no silent edit to an applied migration was made |

## Deviations, review findings and known limits

There is no identified change to the confirmed product behavior in this reconciliation. Internal compatibility choices are documented in preflight/backend reports: transactional snapshot-resolution trigger, modern-to-existing practice projection, long-selection bounds already present at checkpoint, and numeric occurrence confidence retained only inside the legacy canonical table.

Review found a missing stable identity in newly seeded modern cards; the original tooling implementer fixed demo/returning-learner keys and added a recreated-ID matcher assertion before freeze. Independent review confirmed the fix. The final verify then exposed the obsolete provenance extension-command assertion; the same implementer updated that assertion without removing dependency drift checks, and full independent verify passed at dd94c62. No unresolved important implementation finding remains. The applied migration's final blank line remains an explicit release-format gate pending user authorization.

Real-model semantic quality, naturalness, different-situation quality and live selection quality remain **NOT RUN / NOT ACCEPTED**. The opt-in sample runner is available for a separate product review. Section 4.14's already-in-Vault question, section 4.9 downstream behavior, groups 2–4 and all draft/phase-2 work remain outside this execution.

No success screenshots were required because the specification accepts named test evidence; passing E2E output is retained. Failure-only screenshot output directory: `/private/tmp/popcorn-group1-final-e2e-results-aa8ec40` (the passing run produced no failure screenshots).

## Test-service cleanup

The full `src` tree in the tooling service copy matched aa8ec40 byte-for-byte. Independent E2E nevertheless used its own frozen production build and port 3102. After completion, this agent verified listener ports, process IDs and working directories, then stopped only tooling port 3101/PID 82461 (`/private/tmp/popcorn-group1-tooling-e2e`) and acceptance port 3102/PID 89422 (`/private/tmp/popcorn-group1-acceptance-aa8ec40`). Both ports are closed. The user's original 3000 listener/PID 42640 remains running. Reserved E2E identities were cleaned by their guarded suite teardown; no shared queue was globally claimed. No commit or push was performed by this acceptance role.
