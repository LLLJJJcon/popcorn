# Structured Output Reliability — Task 1 Brief

- Plan: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 1.
- Baseline commit: `72d9502b3c770abf6a80dbc6b0107116d8d508f2`.
- Implementation branch: `codex/structured-output-task-1`.
- Worktree: `/private/tmp/popcorn-structured-output-task-1`.

## Scope

Implement only the shared bounded task-aware JSON extraction, typed structured
gateway request options, short transport retry control, safe failure stages,
and public job failure category described by Task 1.

Allowed files are exactly:

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
- `src/server/domain/complete-due-practice.test.ts`
- `tests/integration/practice/attempts.test.ts`
- `tests/contract/ai/saved-analysis.test.ts`
- `docs/engineering/handoffs/structured-output-task-1.md`

Do not modify any other file, dependency, migration, root configuration,
lockfile, UI, extension file, or user-local configuration. Do not stage local
`.DS_Store`, `AGENTS.md`, `CLAUDE.md`, or `next-env.d.ts` files if they appear.

## Interfaces

Consume the existing `StructuredJsonGateway`, OpenAI-compatible Provider,
durable job status, and current strict task parsers. Produce exactly the generic
interfaces frozen in Task 1: `WireDecodeResult`, `WireNormalizer`,
`extractUniqueSemanticObject`, generic `StructuredJsonCompletionOptions<T>`
including `maxTransportRetries`, safe model failure stages/codes, and the
non-leaking `failureCategory` public field.

This task must not change domain artifact schemas or any Saved/Practice
semantics. Existing call sites are migrated mechanically using their current
strict parsers; Tasks 2–4 will add tolerant operation-specific wire schemas.

## Required TDD evidence

First add failing tests and record RED command/output in the handoff report.
The RED set must prove missing symbols/behavior for:

- one valid plus one invalid JSON candidate;
- two valid candidates;
- no JSON object;
- parseable object with missing required field and bounded field path;
- system/user message separation;
- default 503 retry versus `maxTransportRetries: 0`;
- timeout, malformed envelope, and malformed output no-retry behavior;
- `INTERNAL:persistence` public mapping;
- production job response includes `failureCategory` and excludes raw/private
  failure data.

Then implement the minimum code and record GREEN evidence from:

```bash
pnpm exec vitest run src/server/ai/model-output.test.ts tests/integration/model-gateway/structured-json-gateway.test.ts tests/integration/jobs/process-jobs.test.ts tests/integration/jobs/public-job-route.test.ts src/server/domain/complete-due-practice.test.ts tests/integration/practice/attempts.test.ts tests/contract/ai/saved-analysis.test.ts
pnpm typecheck
```

`pnpm typecheck` has seven baseline errors in
`src/features/practice/practice-session.test.tsx` because existing fixtures omit
`savedReturnTarget`. Acceptance requires the same seven exact baseline errors
and no new error; do not edit that unrelated file in Task 1.

Do not run the complete test suite, build, database reset, pgTAP, extension
suite, or Playwright.

## Upstream and license

- YouTube Digest upstream remains `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. This task does not modify or
  recreate its extension code.
- LLM Wiki reference remains `nashsu/llm_wiki` commit
  `723e259309aea5e3850265b631f80224f66dd9f6` (`v0.6.9`). Reuse only the general
  method of treating model output as untrusted and applying deterministic
  validation. Do not copy GPLv3 code, tests, prompts, components, or assets.

## Handoff

Commit the scoped implementation and report with a clear commit message.
Return commit SHA, RED and GREEN evidence, exact changed files, residual risks,
and report path. Do not merge, rebase, push, or modify the controller worktree.
