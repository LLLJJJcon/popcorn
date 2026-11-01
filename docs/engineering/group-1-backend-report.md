# Group 1 backend reconciliation — 2026-11-01

Task A implementation is ready for independent acceptance. This report is implementer self-verification, not the independent group acceptance gate. No commit/push was performed by this agent.

## Delivered behavior

- Both new versioned prompt task instructions match sections 8.1 and 8.2 verbatim. The shared frozen instruction-isolation prefix and final user-data sentence frame JSON input. Inputs include `task`, short highlight IDs and target line references; user data never enters system text. The erroneous selection instruction was removed from Analyze v3.
- Added separate deterministic fixture gateways in each new prompt file. The existing aggregate Saved fixture delegates new versions to them and keeps legacy behavior. Highlight fixtures use characters 3–6 of the first TARGET line when its length is at least 6; learning-card fixtures use the specified examples, `other`, `casual_chat`, and `expression`.
- Centralized `FORMAT_RETRY_MAX = 3` and `ANALYZE_BATCH_SIZE = 5` in `learning-config.ts`. Kept the four-attempt shared format/card budget, immediate retries, proportional token allocation and transport policy. Highlight request timeout is now 20000 ms.
- Analyze rejects unknown, repeated or reordered output IDs and retries the batch. Missing individual cards remain individual failures so correctly associated successful cards survive. Cards carry server-owned evidence and target-line references.
- New v3 candidates omit `confidence`. Legacy candidates still require/read their original numeric confidence. Append-only migration 023 allows modern candidates without confidence at promotion and supplies `1` only for the existing internal canonical occurrence compatibility column; existing explicit values remain unchanged. Promotion decisions, ownership, receipts, atomicity and scheduling are untouched.
- Updated the RLS supplementary-Han boundary test from the retired 200-unit limit to the accepted 10000 UTF-16-unit limit already introduced by migration 022. The test checks acceptance at exactly 10000 and rejection at 10002.
- Regenerated database types using `supabase gen types typescript --local --schema public,private`. Preserved the existing six nullable argument refinements for `mutate_saved_item_highlight`, which the SQL API intentionally accepts but the generator cannot infer. Other output reflects the actual local schema; migration 023 changes no SQL signatures.

## Evidence: RED before GREEN

Initial focused run:

```text
pnpm exec vitest run src/server/jobs/handlers/marked-learning-cards.test.ts src/server/jobs/handlers/highlight-saved-item.test.ts src/server/ai/prompts/analyze-saved-item.v3.test.ts
Test Files 3 failed (3)
Tests 5 failed | 13 passed (18)
```

Failures demonstrated the old erroneous Analyze instruction, 30000 ms timeout, persisted v3 confidence, accepted reversed IDs and accepted extra IDs. A separate initial fixture run failed both tests because the two required independent fixture exports did not exist.

The new modern-card SQL fixture removed confidence before the new migration was applied. Its rollback test failed as intended:

```text
supabase/tests/learning_card_practice_bounds.sql
ERROR: practice promotion candidate is invalid
exit 3
```

SQL RED log: `/private/tmp/popcorn-group1-backend-sql-red.log`.

After implementation:

```text
pnpm exec vitest run src/server/ai/prompts/group-1-fixtures.test.ts src/server/ai/prompts/analyze-saved-item.v3.test.ts src/server/jobs/handlers/marked-learning-cards.test.ts src/server/jobs/handlers/highlight-saved-item.test.ts
Test Files 4 passed (4)
Tests 20 passed (20)
```

Broader backend, contract and integration run:

```text
pnpm exec vitest run src/server/ai src/server/jobs src/server/domain src/server/repositories tests/contract tests/integration
Test Files 54 passed (54)
Tests 953 passed (953)
```

Log: `/private/tmp/popcorn-group1-backend-vitest.log`. The first restricted run failed ten local-launcher tests due to `listen EPERM: operation not permitted 127.0.0.1`; the successful run allowed local loopback listeners. No code change was made for those environmental failures.

Migration 023 was applied incrementally to the local database and recorded in `supabase_migrations.schema_migrations`; no database reset occurred. Local rollback SQL tests then passed with no `not ok` or SQL errors:

| SQL file | Passing assertions |
| --- | ---: |
| `learning_card_practice_bounds.sql` | 18 |
| `promote_practice_attempt.sql` | 54 |
| `rls.sql` | 368 |
| `expression_highlights.sql` | 70 |
| `learning_card_analysis.sql` | 7 |

SQL GREEN log: `/private/tmp/popcorn-group1-backend-sql-green.log`. These commands used `psql -X -v ON_ERROR_STOP=1 -f <file>` against the explicitly local URL, with connection values passed through a private process environment and never printed.

Focused ESLint for all changed backend TypeScript files and `git diff --check -- src/server src/contracts src/types supabase` passed.

A project-wide `pnpm test` was also attempted during parallel work: unit 483/483 and contract 186/186 passed; integration 523 passed and the tooling agent's newly added seed-state RED test failed before its implementation was ready. The controller subsequently reported that seed task's focused tests green; independent acceptance must rerun the integrated suite. Log: `/private/tmp/popcorn-group1-backend-project-test.log`.

The initial `pnpm typecheck` reported only the concurrently edited Saved highlight-editor test's unsupported `ByRoleOptions.exact` properties after backend/type generation fixes. The controller then explicitly assigned the integration correction to this agent: remove the unsupported `exact: true` option from Mark button role queries (string role names remain exact matches by default). `pnpm exec vitest run src/features/saved/highlight-editor.test.tsx` passed 10/10, and the subsequent `pnpm typecheck` passed with exit 0. This is a test typing correction, with no changed interaction assertion or UI behavior.

## Changed paths owned by Task A

- `src/contracts/knowledge.ts`
- `src/server/domain/learning-config.ts` (new)
- `src/server/ai/prompts/instruction-framing.ts` (new)
- `src/server/ai/prompts/highlight-expressions.v1.ts`
- `src/server/ai/prompts/analyze-saved-item.v3.ts`
- `src/server/ai/prompts/analyze-saved-item.v3.test.ts`
- `src/server/ai/prompts/group-1-fixtures.test.ts` (new)
- `src/server/ai/prompts/analyze-saved-item.v1.ts` (fixture dispatch only; old prompt text unchanged)
- `src/server/ai/structured-json-gateway.ts`
- `src/server/jobs/handlers/highlight-saved-item.ts`
- `src/server/jobs/handlers/highlight-saved-item.test.ts`
- `src/server/jobs/handlers/marked-learning-cards.ts`
- `src/server/jobs/handlers/marked-learning-cards.test.ts`
- `src/types/database.generated.ts`
- `supabase/migrations/202611010023_learning_card_confidence_compat.sql` (new)
- `supabase/tests/learning_card_practice_bounds.sql`
- `supabase/tests/rls.sql`
- `docs/engineering/group-1-backend-report.md` (new)
- `src/features/saved/highlight-editor.test.tsx` (controller-authorized integration typing fix after Task B implementation)

Apart from the controller-assigned Mark-query typing correction above, no Saved UI, tooling, package scripts, golden data, E2E files or old migration files were modified by this agent. No groups 2–4, draft, Vault-filter, mastery, assistance or scheduling behavior was implemented.

## Interfaces for tooling

Existing builder/normalizer names remain unchanged. New exports:

- `createHighlightExpressionsFixtureGateway(): StructuredJsonGateway`
- `createAnalyzeMarkedExpressionsFixtureGateway(): StructuredJsonGateway`
- `HIGHLIGHT_EXPRESSIONS_TASK_INSTRUCTION`
- `ANALYZE_MARKED_EXPRESSIONS_TASK_INSTRUCTION`

`buildAnalyzeMarkedExpressionsPrompt` highlights accept `{ id, text, line? }`; actual worker input always supplies the server-mapped `line`. Builders emit JSON as the first line and the frozen user-data sentence on the next line.

## Remaining verification and limits

Independent acceptance owns the final integrated lint/typecheck/build, full SQL suite, extension tests, required E2E and requirement-by-requirement group 1 decision. No live model quality or real-browser success is claimed by this report. No product-visible deviation from confirmed group 1 requirements was introduced; the SQL occurrence confidence and nullable generated argument refinements are internal backward compatibility only.
