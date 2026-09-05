# Structured Output Reliability — Task 2 Handoff

## Scope delivered

- Replaced the Overview, Translation, and Explanation runtime prompts with the
  frozen instruction-isolation system contract and exact JSON user-data block.
- Added task-local tolerant wire normalizers using Task 1 bounded extraction and
  English punctuation normalization.
- Derived stable IDs, timestamps, selection identity, source grounding, and
  Translation order on the server before validating the existing strict domain
  artifact schemas.
- Published the exact latest prompt versions plus finite readable-version
  constants and predicates. Historical cache lookup/reuse remains unimplemented
  for Task 5.
- Terminalized all three durable operations after their bounded Provider
  operation is exhausted and persisted only `safeModelFailureCode` values.

## TDD evidence

RED command:

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts tests/integration/youtube/learning-artifacts.test.ts
```

Actual RED: exit 1, 2 failed files, 23 failed and 60 passed tests. Failures
showed the old prompt/protocol, old prompt versions, fenced Overview prose and
unknown-index quote recovery, atomic Translation rejection, selected-Chinese
echo requirement, and durable retry behavior.

GREEN command:

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts tests/integration/youtube/learning-artifacts.test.ts
```

Actual GREEN before final delivery verification: exit 0, 2 passed files and
83 passed tests.

Typecheck command:

```bash
pnpm typecheck
```

Actual result: exit 2 with exactly the seven allowed baseline
`src/features/practice/practice-session.test.tsx` missing-`savedReturnTarget`
errors at lines 63, 85, 105, 121, 134, 150, and 162. There were no Task 2 or
other new TypeScript errors.

## Files

- `src/server/ai/prompts/youtube-overview.v1.ts`
- `src/server/ai/prompts/translate-segments.v1.ts`
- `src/server/ai/prompts/explain-selection.v1.ts`
- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/provider.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `src/server/jobs/handlers/translate-segments.ts`
- `src/server/jobs/handlers/explain-selection.ts`
- `src/server/ai/prompts/learning-artifact-wire.test.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/structured-output-task-2.md`

## Consumer-chain impact

The chain remains `assistant text -> bounded extraction -> task wire ->
deterministic enrichment -> existing strict domain schema -> artifact store ->
existing extension/Web consumers`. Overview can publish a valid summary with
only valid optional enhancements. Translation can publish a non-empty ordered
subset and leaves omitted IDs available to the existing missing-row flow.
Explanation remains atomic. No database, public contract, UI, extension, or
persistence shape changed.

## Residual risks and boundaries

- This task exposes finite readable-version predicates but deliberately does
  not connect them to historical artifact lookup or dedupe behavior; Task 5
  owns that shared seam.
- The seven known Practice typecheck failures remain outside this task's file
  boundary.
- No real Provider, full suite, build, database, Playwright, extension logic,
  configuration, or lockfile action was run or changed.
