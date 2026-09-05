# Structured Output Task 2 — Review Repair Handoff

## Scope repaired

- Tightened the Overview summary-only fallback so Markdown fences using either
  backticks or tildes and JSON structural fragments cannot be persisted as
  plain English prose. Ordinary unfenced English prose remains supported.
- Classified private-input parsing and private-input/evidence read exceptions
  as `INTERNAL:persistence` before any model resolution or invocation.
- Kept the existing stage boundary after evidence is read: grounding failures
  remain `PROVIDER_OUTPUT_INVALID:grounding`, while model gateway errors retain
  their own safe wire, transport, timeout, or Provider stage.
- Preserved terminal-on-first-failure behavior for Overview, Translation, and
  Explanation. No public artifact, persistence schema, prompt, version,
  extension, or Web consumer shape changed.

## TDD evidence

RED command:

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts tests/integration/youtube/learning-artifacts.test.ts
```

Actual RED: exit 1, one failed and one passed file, 8 failed and 83 passed
tests. The two Overview fixtures (`~~~markdown` prose and the broken fragment
`"overview":"A summary."}`) resolved as summary-only content instead of
failing at `json_extract`. Private-input and evidence read exceptions for all
three handlers persisted `PROVIDER_OUTPUT_INVALID:grounding` instead of
`INTERNAL:persistence`.

GREEN command:

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts tests/integration/youtube/learning-artifacts.test.ts
```

Actual GREEN before final delivery verification: exit 0, 2 passed files and
91 passed tests. Existing cases continue to accept ordinary unfenced English
Overview prose and preserve model wire, grounding, and transport stages.

## Typecheck differential

```bash
pnpm typecheck
```

Actual result: non-zero (exit 1) with exactly the seven allowed baseline
`src/features/practice/practice-session.test.tsx` missing-`savedReturnTarget`
errors at lines 63, 85, 105, 121, 134, 150, and 162. There were no Task 2 or
other new TypeScript errors.

## Files

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/structured-output-task-2-review-repair.md`

## Consumer-chain impact and residual risk

The consumer chain remains `assistant text -> bounded extraction -> task wire
-> deterministic enrichment -> strict domain schema -> artifact store ->
existing extension/Web consumers`. The repair changes only admission of the
Overview plain-text exception and the safe durable classification of database
read exceptions. Translation and Explanation consume the common handler phase
boundary without task-specific duplication.

No known Task 2 repair risk remains. The seven unrelated Practice fixture
typecheck errors remain outside the repair allowlist. No full suite, build,
database reset, pgTAP, Playwright, real Provider, merge, rebase, or push was
run. The YouTube Digest MIT pin and the LLM Wiki GPL method-only boundary were
not touched.
