# Structured Output Reliability — Task 1 Handoff

- Baseline: `72d9502b3c770abf6a80dbc6b0107116d8d508f2`
- Branch: `codex/structured-output-task-1`
- Worktree: `/private/tmp/popcorn-structured-output-task-1`
- Scope: shared bounded semantic JSON extraction, typed gateway request
  options, short transport retry, safe failure stages, and public job failure
  categories only.

## Implemented contract

- Added a bounded, linear, quote/escape-aware top-level object scanner. It
  accepts exactly one task-valid semantic payload, unwraps only the documented
  one-level `result`/`data`/`output` wrappers, retains at most eight candidates,
  rejects object roots inside arrays, and never repairs JSON.
- Added `WireDecodeResult`, `WireNormalizer`, `JsonExtractionResult`,
  `ModelOutputStage`, `SafeModelFailure`, `extractUniqueSemanticObject`,
  `normalizeEnglishPunctuation`, and `safeModelFailureCode`.
- Replaced the loose structured gateway call with
  `complete<T>(promptVersion, userPrompt, options): Promise<T>`. The options
  carry a separately bounded system prompt, timeout, output-token limit,
  optional zero/one transport retries, and the task normalizer.
- OpenAI-compatible requests keep the ordinary chat-completions shape. They
  retry once by default only for pre-response connection failures and HTTP
  429/502/503/504. Timeout, malformed envelope, extraction, and wire-schema
  failures do not recall the Provider. Overview's existing path explicitly
  requests zero retries.
- Existing Saved, activation, and evaluation call sites were mechanically
  migrated with their current strict parsers. Domain artifact schemas and
  business decisions are unchanged; Tasks 2–4 replace these temporary strict
  normalizers with operation-specific tolerant wire contracts.
- Durable Saved-analysis errors now use bounded `CODE:stage[:fieldPath]`
  diagnostics. The public job boundary maps both staged and historical codes
  to `model_unavailable`, `model_output`, or `internal`, serializes only known
  public fields, and never returns `last_error_code` or private job data.

## RED evidence

The worktree initially lacked dependencies, so a read-only link to the already
installed controller-worktree dependency store was used and the underlying
executables were invoked directly. No dependency or lockfile changed.

1. `./node_modules/.bin/vitest run src/server/ai/model-output.test.ts`
   - Exit `1`.
   - The suite failed to resolve the new `@/server/ai/model-output` module.
2. `./node_modules/.bin/vitest run src/server/ai/model-output.test.ts tests/integration/model-gateway/structured-json-gateway.test.ts tests/integration/jobs/process-jobs.test.ts tests/integration/jobs/public-job-route.test.ts`
   - Exit `1`.
   - 13 expected failures: missing extractor/module, missing safe category and
     production status reader, old combined system message, no 503 retry,
     missing stages, and no task-aware candidate recovery. The timeout case
     hit the old five-second test timeout because the old positional API
     ignored the one-millisecond task timeout.
3. `./node_modules/.bin/vitest run src/server/ai/model-output.test.ts`
   after adding array-root fixtures:
   - Exit `1`; 2 expected failures proved the first scanner revision wrongly
     accepted an object nested in a JSON array. The scanner was then corrected
     before GREEN.
4. `./node_modules/.bin/vitest run tests/integration/jobs/process-jobs.test.ts`
   after adding historical-code fixtures:
   - Exit `1`; 2 expected failures proved unstaged historical Provider codes
     were incorrectly categorized as `internal`. Compatibility mapping was
     then added.

## GREEN evidence

Fresh focused verification:

```text
./node_modules/.bin/vitest run \
  src/server/ai/model-output.test.ts \
  tests/integration/model-gateway/structured-json-gateway.test.ts \
  tests/integration/jobs/process-jobs.test.ts \
  tests/integration/jobs/public-job-route.test.ts \
  src/server/domain/complete-due-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  tests/contract/ai/saved-analysis.test.ts

Test Files  7 passed (7)
Tests       129 passed (129)
Exit        0
```

TypeScript verification was also run with the direct equivalent of
`pnpm typecheck`:

```text
./node_modules/.bin/tsc --noEmit --pretty false
Exit 1 (non-zero because of the baseline errors below)
```

It reports only seven pre-existing `savedReturnTarget` errors in
`src/features/practice/practice-session.test.tsx` at lines 63, 85, 105, 121,
134, 150, and 162. `git diff --exit-code` against the recorded baseline for
that test and its component exits `0`; Task 1 adds no TypeScript errors and did
not modify that UI boundary.

`git diff --check` exits `0`.

## Changed files

- `src/server/ai/model-output.ts`
- `src/server/ai/model-output.test.ts`
- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/structured-json-gateway.ts`
- `src/server/ai/provider.ts`
- `src/server/ai/prompts/analyze-saved-item.v1.ts`
- `src/server/ai/prompts/activate.v1.ts`
- `src/server/ai/prompts/evaluate.v1.ts`
- `src/server/jobs/handlers/analyze-saved-item.ts`
- `src/server/domain/create-practice-task.ts`
- `src/server/repositories/attempt-repository.ts`
- `src/server/domain/complete-due-practice.ts`
- `src/server/jobs/process-jobs.ts`
- `src/app/api/v1/jobs/[jobId]/route.ts`
- `tests/integration/model-gateway/structured-json-gateway.test.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/jobs/public-job-route.test.ts`
- `src/server/domain/complete-due-practice.test.ts` (controller-authorized
  mechanical generic gateway test-double migration)
- `tests/integration/practice/attempts.test.ts` (controller-authorized
  mechanical generic gateway test-double migration)
- `tests/contract/ai/saved-analysis.test.ts` (controller-authorized mechanical
  generic gateway fixture migration)
- `docs/engineering/handoffs/structured-output-task-1.md`

## Consumer-chain impact

The final object returned by the live gateway is now already the unique value
accepted by the task normalizer. Existing domain validators still run before
persistence, so Saved candidates, Practice drafts/attempts, and learning
artifact records keep their prior strict shapes. The only public response
shape addition is nullable `failureCategory`; internal error strings and
private job inputs remain server-only.

## Residual risks and next-task obligations

- Tasks 2–4 must replace the temporary current-schema normalizers and generic
  system copy with their frozen minimal semantic wire schemas and exact prompt
  contracts. Task 1 intentionally does not change model-owned versus
  server-owned semantic fields.
- Task 2 owns staged durable errors and terminal-on-first-operation behavior
  for Overview, Translation, and Explanation handlers. Task 3 owns the same
  final policy and deterministic enrichment for Saved analysis.
- The existing seven `practice-session.test.tsx` type errors must be repaired
  by their UI owner; they are outside this task's allowed files.
- No upstream source was copied. The task uses only the general untrusted-model
  output validation method; no GPLv3 LLM Wiki code, prompt, test, component, or
  asset was reused.
