# Structured Output Task 1 — Review Repair Handoff

- Reviewed implementation: `653b9e3446ba397d0da7230f894c7fe51d873061`
- Branch: `codex/structured-output-task-1-repair`
- Worktree: `/private/tmp/popcorn-structured-output-task-1-repair`
- Scope: the two reviewed production defects and the requested retry coverage
  only.

## Technical findings and repairs

1. `readBoundedResponse` caught an `AbortError` raised while reading a response
   body and converted it to `PROVIDER_UNAVAILABLE:transport`. Because the outer
   request boundary received an already-classified `ModelGatewayError`, it could
   no longer use its timeout state to classify the abort. The reader now lets
   abort errors reach the outer boundary; a response whose headers resolve and
   whose body stalls is reported as `PROVIDER_UNAVAILABLE:timeout` and is not
   retried.
2. The prior field-path sanitizer replaced characters and truncated arbitrary
   strings, so credentials, UUIDs, user text, model text, and opaque identifiers
   could remain recognizable in durable error codes. Field paths now use a
   finite allowlist of non-sensitive schema tokens plus canonical numeric indexes
   of at most three digits. The complete path is omitted if any token is not in
   that grammar. Valid paths such as `candidates.0.expression` remain available.
3. Transient HTTP retry coverage is parameterized across 429, 502, 503, and 504.
   A separate test proves that the default policy retries exactly one
   pre-response connection failure. The existing zero-retry task case remains
   explicit.

## RED evidence

The repair worktree reused the already-installed Task 1 dependency directory by
an untracked local symlink. `pnpm exec` attempted to manage that linked directory,
so the underlying executables were used directly. No dependency or lockfile was
changed.

1. Body-stream timeout regression:

   ```text
   ./node_modules/.bin/vitest run tests/integration/model-gateway/structured-json-gateway.test.ts \
     -t "preserves timeout classification when response headers arrive before the body stalls"

   Test Files  1 failed (1)
   Tests       1 failed | 9 skipped (10)
   Expected stage: timeout
   Received stage: transport
   ```

2. Safe field-path grammar:

   ```text
   ./node_modules/.bin/vitest run src/server/ai/model-output.test.ts \
     -t "field paths|safe model failure codes"

   Test Files  1 failed (1)
   Tests       6 failed | 1 passed | 15 skipped (22)
   ```

   All six unsafe fixtures were still present in extracted diagnostics: an
   API-key-like value, a UUID, user text, raw model text, a long opaque
   identifier, and an arbitrary label.

3. Retry coverage mutation check:

   After adding the tests, the eligible-status list was temporarily reduced to
   503 and the pre-response connection retry branch was temporarily disabled.
   The mutation was not retained.

   ```text
   ./node_modules/.bin/vitest run tests/integration/model-gateway/structured-json-gateway.test.ts \
     -t "retries one eligible HTTP|retries one pre-response connection failure"

   Test Files  1 failed (1)
   Tests       4 failed | 1 passed | 10 skipped (15)
   ```

   The 429, 502, 504, and connection-failure cases failed while the 503 control
   case passed, proving the new cases detect removal of their production
   branches.

## GREEN evidence

Individual repair checks:

```text
Body-stream timeout regression:
Test Files  1 passed (1)
Tests       1 passed | 9 skipped (10)

Safe field-path grammar:
Test Files  1 passed (1)
Tests       7 passed | 15 skipped (22)

Transient retry coverage after restoring the correct branches:
Test Files  1 passed (1)
Tests       5 passed | 10 skipped (15)
```

Fresh focused verification required by the repair brief:

```text
./node_modules/.bin/vitest run \
  src/server/ai/model-output.test.ts \
  tests/integration/model-gateway/structured-json-gateway.test.ts

Test Files  2 passed (2)
Tests       37 passed (37)
Exit        0
```

```text
./node_modules/.bin/vitest run \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/jobs/public-job-route.test.ts \
  src/server/domain/complete-due-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  tests/contract/ai/saved-analysis.test.ts

Test Files  5 passed (5)
Tests       104 passed (104)
Exit        0
```

```text
./node_modules/.bin/tsc --noEmit --pretty false
Exit 1
```

TypeScript reports only the seven accepted baseline TS2741 errors for missing
`savedReturnTarget` fixtures in
`src/features/practice/practice-session.test.tsx` at lines 63, 85, 105, 121,
134, 150, and 162. No repair-owned TypeScript error was reported, and that
unrelated file was not modified.

`git diff --check` exits 0.

## Changed files

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/model-output.ts`
- `src/server/ai/model-output.test.ts`
- `tests/integration/model-gateway/structured-json-gateway.test.ts`
- `docs/engineering/handoffs/structured-output-task-1-review-repair.md`

## Residual risk

- The field-path allowlist intentionally trades diagnostic granularity for
  confidentiality. A future wire schema that introduces a new safe field name
  must add that token deliberately; until then its path is omitted while the
  safe failure code and stage remain intact.
- The focused response-body test uses a deterministic abort-aware stream double.
  No real Provider smoke or unrelated full suite was run, as required by the
  repair brief.
