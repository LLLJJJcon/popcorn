# Structured Output Task 1 — Review Repair Brief

- Plan: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 1.
- Recorded task baseline: `72d9502b3c770abf6a80dbc6b0107116d8d508f2`.
- Reviewed implementation source: `b6e0cb5c7c3b450c5efe7a968aa0f7d6397f8c22`.
- Repair branch: `codex/structured-output-task-1-repair`.
- Repair worktree: `/private/tmp/popcorn-structured-output-task-1-repair`.

## Required fixes

1. Preserve an abort during `Response.body` reading until the outer request
   boundary classifies it as `PROVIDER_UNAVAILABLE:timeout`. Add a response
   whose headers resolve but body stalls; assert one fetch and timeout stage.
2. Replace free-form field-path sanitizing with a finite non-sensitive path
   grammar/constructor. Only schema tokens and numeric indexes may survive;
   unrecognized tokens or values resembling UUIDs, long opaque identifiers,
   credentials, raw user/model text, or arbitrary labels are omitted. Add
   explicit tests proving API-key-like, UUID, user text, and raw-text values
   cannot enter `safeModelFailureCode`.
3. The authoritative Task 1 brief on this branch already includes the three
   controller-authorized mechanical test-double files. Do not revert it.
4. Parameterize transient HTTP tests across 429/502/503/504 and cover the
   default pre-response connection-failure retry once.

## File ownership

Allowed modifications are exactly:

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/model-output.ts`
- `src/server/ai/model-output.test.ts`
- `tests/integration/model-gateway/structured-json-gateway.test.ts`
- `docs/engineering/handoffs/structured-output-task-1-review-repair.md`

Do not modify any other source, test, document, dependency, root config,
lockfile, migration, Web UI, or extension file.

## TDD and focused verification

For each production fix, first add/run a failing regression test and record RED.
Then implement the minimum repair and run:

```bash
pnpm exec vitest run src/server/ai/model-output.test.ts tests/integration/model-gateway/structured-json-gateway.test.ts
pnpm exec vitest run tests/integration/jobs/process-jobs.test.ts tests/integration/jobs/public-job-route.test.ts src/server/domain/complete-due-practice.test.ts tests/integration/practice/attempts.test.ts tests/contract/ai/saved-analysis.test.ts
pnpm typecheck
git diff --check
```

The typecheck acceptance is no new error beyond the same seven baseline
`practice-session.test.tsx` missing-`savedReturnTarget` fixture errors. Do not
edit that unrelated file. Do not run the full suite, build, database reset,
pgTAP, extension suite, or Playwright.

## Upstream and license

Do not touch YouTube Digest-derived extension code. Do not copy LLM Wiki
GPLv3 code, tests, prompts, components, or assets; the repair is original
boundary handling against the existing pinned references.

## Handoff

Commit the scoped repair and handoff report. Return commit SHA, per-finding RED
and GREEN evidence, changed files, and residual risk. Do not merge, rebase, or
push.
