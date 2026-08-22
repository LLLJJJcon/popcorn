# Batch C Task 2 revised handoff — Due Practice completion

## Delivered scope

- `create-transfer-task.ts` creates an answer-free, normalized different-context prompt and leaves the original prompt out of its public task.
- `complete-due-practice.ts` reads an owner-scoped transfer task, selects the CI fixture before gateway resolution, evaluates before invoking the sole `complete_due_practice` RPC, preserves RPC IDs/state/schedule, and exposes generic no-store error handlers.
- The dynamic owner route creates/reads the transfer task by review ID and completes it; the Due UI holds the learner response on failure and allows a retry.
- The existing Due-list route now maps unexpected errors to a no-store generic response rather than passing through a repository failure.

## TDD evidence

RED was recorded before production modules existed:

```bash
node_modules/.bin/vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts
```

Both suites failed to resolve the absent domain modules. GREEN subsequently covered independent `tried -> reused`, RPC-owned `reused -> owned`, assisted non-promotion, deterministic exact replay, stale/future/graph failure mapping, zero completion RPC calls on gateway failure, answer-free transfer context, generic public errors, and UI response/retry behavior.

## Verification

- `node_modules/.bin/vitest run tests/integration/practice/due-transfer.test.ts src/server/domain/complete-due-practice.test.ts src/features/practice/due-practice.test.tsx`
- `node_modules/.bin/tsc --noEmit`
- `node_modules/.bin/eslint src/server/domain/create-transfer-task.ts src/server/domain/complete-due-practice.ts src/features/practice/due-practice.tsx src/app/api/v1/practice/due`
- `git diff --check`

No migration, generated type, repository, shared gateway/runtime/Vault, package, lockfile, extension, ledger, database reset, pgTAP, or concurrency command was changed or run.

## Remaining review focus

- Read-only review should confirm the transfer-task insert is not treated as a completion write and that the frozen RPC remains the only attempt/mastery/review mutation.
- The browser UI intentionally exposes only unaided submission. The domain and RPC input preserve `none`, `hint`, and `model_answer` for future assistance controls without asserting client-supplied mastery.

## Independent-review repair from `5c80564`

The first independent review found two blocking replay/context defects and three bounded
validation/error-boundary gaps. The repair stayed inside the reviewed Task 2 file
allowlist and did not change CONTRACT-015, migrations, generated types, gateway/Vault
code, root configuration, or the lockfile.

- Transfer prompts now include the stable due moment, so sequential reviews for one
  expression create genuinely different learner-visible contexts. Their application
  fingerprint uses the same PostgreSQL `char_length`-prefixed four-field SHA-256 input
  as migration 014; the production repository test emulates the database trigger and
  proves two inserts do not collide.
- Before any gateway resolution or Provider call, completion now reads the owner-scoped
  public review/task state. A completed review loads its public persisted attempt and
  replays the frozen RPC with the exact response, assistance, scores, feedback,
  submitted timestamp, and evaluation provenance. Changed response or assistance fails
  closed with no Provider/Vault/RPC call. Pending-but-future, cancelled, malformed, and
  non-owned graphs are rejected before egress.
- The RPC result validator now recognizes only `tried -> reused`, `reused -> reused|owned`,
  and absorbing `owned -> owned` for independent successes; every non-independent
  result must preserve the prior state.
- Both production route modules now await their handler promises inside the generic
  no-store error boundary, with real asynchronous-rejection route tests.

### Repair TDD evidence

The initial focused RED run reported 12 expected failures across 26 tests: the second
database-emulated insert hit `practice_task_expression_context_unique`; completed and
changed retries reached the Provider; cancelled/future tasks reached evaluation; three
illegal mastery transitions resolved; and the list plus dynamic route promises escaped
their `try/catch`. A separate owner-scoped replay-adapter RED failed because
`findCompletionState` did not exist.

After the minimal repair:

- focused domain/integration: 27/27;
- focused domain/integration/UI: 28/28;
- `tsc --noEmit`: exit 0;
- scoped ESLint and `git diff --check`: exit 0.

No database/full-build/pgTAP gate was run because this repair cannot change the frozen
database contract. Remaining risk is limited to final independent review and the
controller's scoped integration gate.

## Second independent-review repair from `ec07b42`

The second review identified four bounded defects. This repair stayed within the
approved two domain modules, their focused tests, and this handoff; routes, UI,
migrations, generated contracts, gateway/Vault code, root configuration, lockfile,
and ledger remain unchanged.

- Transfer prompts now rotate through deterministic everyday situations (lunch,
  online shopping, transport, and rain) using the owner-scoped count of existing due
  tasks as their stable ordinal. The ordinal also changes a learner-visible scenario
  detail, so maintenance reviews remain generatable and the database's four-field
  fingerprint stays unique without relying on UTC text as the semantic difference.
- Every explicit-timezone instant is normalized to canonical ISO `Z` form before
  comparison, scheduling, replay, RPC input, or public return. Invalid or timezone-less
  instants fail closed. Both initial completion and exact persisted replay cover
  PostgREST-style `+00:00` timestamps.
- Completion-state reads now include owner-scoped `user_expressions` evidence. Pending
  reviews require exact current mastery; completed replay requires the current mastery
  to be a legal result of the persisted attempt. A stale graph returns no state before
  gateway resolution, Provider evaluation, or completion RPC.
- Transfer GET creation validates pending/due/completion fences, expression mastery,
  and the full review/task graph before returning an existing task. The same gates are
  re-read after an insert race.

### Second repair TDD evidence

The focused RED run produced 12 expected failures across 38 tests: `+00:00` values
failed schedule validation, timezone-less clocks reached evaluation, sequential
transfers reused one semantic situation, existing ineligible tasks were returned, and
stale mastery/replay timestamps were accepted without normalization.

Fresh GREEN verification after the minimal repair:

- focused domain/integration/UI: 41/41;
- `tsc --noEmit`: exit 0;
- scoped ESLint and `git diff --check`: exit 0.

No database, build, pgTAP, migration, generated-type, or concurrency command was run,
as required by the repair brief. The remaining risk is limited to independent review
and the controller's scoped integration gate.

## Third independent-review repair from `f01ae0c`

The third review found two final bounded defects. This repair changes only the two
domain modules, their focused tests, and this handoff; the frozen completion RPC,
migrations, generated contracts, routes, UI, gateway/Vault code, root configuration,
lockfile, and ledger remain unchanged.

- Transfer generation now classifies the four finite templates by semantic anchors.
  It reads owner-scoped prior due prompts for the same expression and excludes both
  the original activation scenario and every prior due scenario while an unused
  semantic kind remains. Once all four kinds are exhausted, the stable ordinal rule
  may reuse a kind while the ordinal-specific learner detail keeps the database
  context fingerprint unique.
- Completed replay now reads exactly one owner-scoped immutable `mastery_events` row
  for the persisted attempt. The event must begin at the completed review's historical
  mastery, make a transition legal for the persisted attempt, share its completion
  instant, and not be ahead of current expression mastery. This permits exact replay
  of an old `tried -> reused` receipt after a later review has advanced the expression
  to `owned`, while missing, duplicate, inconsistent, illegal, or rolled-back graphs
  fail closed before gateway resolution or Provider egress.

### Third repair TDD evidence

The focused RED run produced six expected failures across 21 integration tests: the
exact lunch-template collision produced `shopping -> shopping`, the adapter never
read `mastery_events`, missing or inconsistent events were accepted, and an old
`tried -> reused` replay at current `owned` failed with `NOT_FOUND` before its exact
RPC receipt could be returned.

Fresh GREEN verification after the minimal repair:

- focused domain/integration: 47/47;
- `tsc --noEmit`: exit 0;
- scoped ESLint and `git diff --check`: exit 0.

No database, build, pgTAP, migration, generated-type, or concurrency command was run,
as required by this bounded repair brief. Remaining risk is limited to fresh independent
review and the controller's scoped integration gate.
