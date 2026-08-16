# Popcorn Parallel Batch C Progress and Chinese Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add evidence-based Progress, Chinese semantic relations, and regression-tested Chinese/English AI quality without destabilising the core loop.

**Architecture:** Progress reads append-only evidence, relations use pgvector plus communicative-function filters, and Chinese quality is enforced through versioned fixtures and prompts. Each parallel Agent owns separate files.

**Tech Stack:** PostgreSQL, pgvector, Next.js, OpenAI embeddings, Vitest, Playwright.

## Global Constraints

- Activity volume and demonstrated mastery are displayed separately.
- pgvector suggestions never merge records automatically.
- English explanations must cite the exact Chinese evidence span.
- Traditional characters, regional usage, ambiguity, and slang produce caveats rather than silent normalisation.
- Shared migrations are created by the primary Agent before Agent B begins.

---

### Task P0: Add pgvector relation schema

**Agent:** Primary Agent

**Files:**

- Create: supabase/migrations/202608160003_expression_vectors.sql
- Modify: src/types/database.generated.ts through regeneration
- Test: supabase/tests/relations.sql

**Interfaces:**

- Produces match_expression_senses(query_embedding, match_threshold, match_count, language_code).

- [ ] **Step 1: Add failing SQL tests**

Assert the function excludes another language code, excludes the same expression ID, orders by cosine similarity descending, and never returns another user's private occurrence data.

- [ ] **Step 2: Implement vector column and function**

Use vector(1536), matching OPENAI_EMBEDDING_DIMENSIONS passed by M4. Keep expression_senses language-scoped and relations advisory.

- [ ] **Step 3: Verify and commit**

Run:

    pnpm db:reset
    pnpm db:test
    pnpm exec supabase gen types typescript --local > src/types/database.generated.ts
    pnpm typecheck
    git add supabase src/types/database.generated.ts
    git commit -m "feat: add expression similarity schema"

### Task A1: Progress aggregation

**Agent:** Batch C Agent A

**Files:**

- Create: src/server/repositories/progress-repository.ts
- Create: src/features/progress/schema.ts
- Create: src/app/api/v1/progress/route.ts
- Test: tests/integration/progress/progress-summary.test.ts

**Interfaces:**

- Produces ProgressSummary:
  - periodStart and periodEnd
  - attemptsCompleted
  - dueTasksCompleted
  - independentReuseCount
  - masteryDistribution
  - recentTransitions

- [ ] **Step 1: Write failing aggregation tests**

Seed assisted attempts, independent attempts, due-task completions, and mastery transitions around a fixed UTC week boundary. Assert each metric and ensure the same attempt is counted once.

- [ ] **Step 2: Implement repository query**

Compute from persisted attempts, review_tasks, and mastery_events. Do not cache a browser-computed total or count failed AI runs as learning activity.

- [ ] **Step 3: Implement GET route**

Accept ISO date from and to query parameters with a maximum 93-day range. Default to the current UTC week.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:integration -- progress-summary
    pnpm typecheck
    git add src/server/repositories/progress-repository.ts src/features/progress/schema.ts src/app/api/v1/progress tests/integration/progress
    git commit -m "feat: add evidence-based progress summary"

### Task A2: Progress and Expression Health pages

**Agent:** Batch C Agent A

**Files:**

- Create: src/features/progress/progress-dashboard.tsx
- Create: src/features/progress/progress-dashboard.test.tsx
- Create: src/features/progress/expression-health.tsx
- Create: src/app/(app)/progress/page.tsx
- Test: tests/e2e/progress.spec.ts

**Interfaces:**

- Consumes ProgressSummary and Vault records.
- Produces an English-language Progress page.

- [ ] **Step 1: Write failing dashboard tests**

Assert headings This week, Independent reuse, Mastery evidence, and Expressions needing attention. Assert activity counts are not labelled mastery.

- [ ] **Step 2: Implement dashboard**

Use accessible HTML lists and compact visual bars rather than a chart dependency. Show seen/understood/tried/reused/owned counts and recent transitions with Chinese expressions.

- [ ] **Step 3: Implement health rules**

Categories:

- Seen but not tried after 7 days.
- Tried but not reused after 14 days.
- Failed due task.
- One independent context away from owned.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/progress
    pnpm test:e2e -- progress
    pnpm typecheck
    git add src/features/progress src/app/\(app\)/progress tests/e2e/progress.spec.ts
    git commit -m "feat: add progress and expression health"

### Task B1: Embeddings and duplicate suggestions

**Agent:** Batch C Agent B

**Files:**

- Create: src/server/repositories/relation-repository.ts
- Create: src/features/relations/schema.ts
- Create: src/features/relations/find-relations.ts
- Create: src/app/api/v1/vault/[userExpressionId]/relations/route.ts
- Test: tests/integration/relations/duplicate-suggestions.test.ts

**Interfaces:**

- Consumes AiProvider.embedChinese().
- Produces findRelatedExpressions(userId, userExpressionId): Promise<RelationSuggestion[]>.
- RelationSuggestion is { userExpressionId: string; expression: string; meaning: string; relationshipReason: string; similarity: number }.

- [ ] **Step 1: Write failing relation tests**

Use deterministic vectors. Assert exact duplicates rank first, function mismatch lowers ranking, source expression is excluded, another user cannot access suggestions, and no record is merged automatically.

- [ ] **Step 2: Implement embedding text**

Canonical embedding input contains Chinese expression, English meaning, communicative function, tone, and one Chinese context example in a labelled stable order.

- [ ] **Step 3: Implement repository and route**

Persist embedding model/version. Return similarity and reason fields. Require explicit primary-Agent-owned merge work for any future merge feature; first release only displays suggestions.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:integration -- duplicate-suggestions
    pnpm typecheck
    git add src/server/repositories/relation-repository.ts src/features/relations src/app/api/v1/vault tests/integration/relations
    git commit -m "feat: add Chinese expression relations"

### Task B2: Related-expression presentation

**Agent:** Batch C Agent B

**Files:**

- Create: src/features/relations/related-expressions.tsx
- Create: src/features/relations/related-expressions.test.tsx
- Modify: src/features/vault/expression-card.tsx

**Interfaces:**

- Consumes RelationSuggestion[].
- Produces presentational Related expressions section.

- [ ] **Step 1: Write failing presentation tests**

Assert Chinese expression, English meaning, relationship reason, and confidence band. Do not display a Merge button.

- [ ] **Step 2: Implement component**

Use High, Medium, and Low confidence labels; do not expose raw vector values as a learning score.

- [ ] **Step 3: Verify and commit**

Run:

    pnpm vitest run src/features/relations
    pnpm typecheck
    git add src/features/relations src/features/vault/expression-card.tsx
    git commit -m "feat: show related Chinese expressions"

### Task C1: Chinese analysis regression set

**Agent:** Batch C Agent C

**Files:**

- Create: tests/fixtures/chinese/analysis-cases.ts
- Create: tests/contract/ai/chinese-analysis.test.ts
- Modify: src/server/ai/prompts/scan-extract.v1.ts only if a failing fixture proves a defect

**Interfaces:**

- Produces versioned Chinese analysis cases consumed by provider evaluation.

- [ ] **Step 1: Add concrete fixtures**

Include:

- 这也太离谱了吧。 — strong informal reaction.
- 这事儿说白了就是钱的问题。 — conversational framing phrase.
- 你方便的时候发给我就行。 — polite low-pressure request.
- 我不是很赞同这个说法。 — softened disagreement.
- 绝绝子 — dated online slang requiring a caveat.
- 这个方案挺好的。 — 挺 must not be explained as physical standing.
- 他把书看完了。 — 把 construction must not be extracted as a reusable social expression by default.
- 妳好 — Traditional character should be preserved and flagged, not silently rewritten.

- [ ] **Step 2: Write schema and semantic assertions**

Assert exact evidence spans, English explanation presence, no hallucinated Chinese phrase, maximum three expressions, and caveats for slang or regional/script variants.

- [ ] **Step 3: Run tests against FakeAiProvider and configured live-eval mode**

Run:

    pnpm test:contract -- chinese-analysis

Expected: deterministic fixture-mode tests pass. Live API evaluation is opt-in through RUN_LIVE_AI_EVALS=1 and is not required in normal CI.

- [ ] **Step 4: Commit**

Run:

    git add tests/fixtures/chinese tests/contract/ai/chinese-analysis.test.ts src/server/ai/prompts/scan-extract.v1.ts
    git commit -m "test: add Chinese analysis regression set"

### Task C2: Chinese response evaluation regression set

**Agent:** Batch C Agent C

**Files:**

- Create: tests/fixtures/chinese/evaluation-cases.ts
- Create: tests/contract/ai/chinese-evaluation.test.ts
- Create: src/features/chinese/explanation-guard.ts
- Test: src/features/chinese/explanation-guard.test.ts
- Modify: src/server/ai/prompts/evaluate.v1.ts only if a fixture proves a defect

**Interfaces:**

- Produces assertEnglishExplanation(EvaluationResult): void.

- [ ] **Step 1: Add evaluation cases**

Cover correct natural use, grammatically correct but contextually rude use, understandable but unnatural word order, wrong register, English-only learner response, and copied full model answer.

- [ ] **Step 2: Assert three separate dimensions**

Every result has independent accuracy, naturalness, and contextual-fit scores and English feedback. The evaluator must not claim a dialect or register is universally wrong when it is context-dependent.

- [ ] **Step 3: Implement explanation guard**

Reject empty feedback, feedback dominated by unexplained Chinese, or missing dimension labels before persistence.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm test:contract -- chinese-evaluation
    pnpm vitest run src/features/chinese
    pnpm typecheck
    git add tests/fixtures/chinese tests/contract/ai/chinese-evaluation.test.ts src/features/chinese src/server/ai/prompts/evaluate.v1.ts
    git commit -m "test: add Chinese evaluation regression set"

### Task C3: Mixed-script desktop rendering

**Agent:** Batch C Agent C

**Files:**

- Create: tests/e2e/chinese-rendering.spec.ts
- Modify: src/styles/tokens.css if rendering evidence requires a fix

**Interfaces:**

- Verifies supported browser rendering, not domain behaviour.

- [ ] **Step 1: Add browser cases**

Test Simplified Chinese, preserved Traditional characters, Chinese punctuation, long English explanation, pinyin with tone marks, and mixed Chinese/English lines at 1024x768 and 1440x900.

- [ ] **Step 2: Use visual and semantic assertions**

Assert no horizontal document overflow, Chinese spans have lang zh-CN, English explanation retains lang en, focused controls remain visible, and critical text is not clipped.

- [ ] **Step 3: Verify and commit**

Run:

    pnpm test:e2e -- chinese-rendering
    pnpm typecheck
    git add tests/e2e/chinese-rendering.spec.ts src/styles/tokens.css
    git commit -m "test: verify Chinese desktop rendering"

### Task I-C: Primary-Agent integration gate

**Agent:** Primary Agent

**Files:**

- Test: all Batch C checks.

- [ ] **Step 1: Run database and focused suites**

Run:

    pnpm db:reset
    pnpm db:test
    pnpm test:integration -- progress-summary duplicate-suggestions
    pnpm test:contract -- chinese-analysis chinese-evaluation
    pnpm test:e2e -- progress chinese-rendering

Expected: all commands exit 0.

- [ ] **Step 2: Run full verification**

Run:

    pnpm verify
    pnpm build
    git diff --check

Expected: all commands exit 0.

- [ ] **Step 3: Commit integration-only adjustments**

Run:

    git add src tests supabase
    git commit -m "feat: integrate progress and Chinese quality"

Skip the commit only when git diff --quiet confirms no integration changes.
