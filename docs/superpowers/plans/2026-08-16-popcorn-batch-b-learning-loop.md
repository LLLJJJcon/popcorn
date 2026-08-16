# Popcorn Parallel Batch B Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build the learner-first response workflow, persistent Expression Vault and Active Queue, and coherent desktop states, then integrate them into one evidence-producing loop.

**Architecture:** Practice emits a frozen AttemptRecorded event. Memory consumes the event through primary-Agent-owned orchestration. Desktop components remain presentational and cannot alter mastery or queue behaviour.

**Tech Stack:** Next.js, React, TanStack Query, Zod, Supabase, Vitest, Testing Library, Playwright.

## Global Constraints

- The learner submits Chinese before seeing a complete model answer.
- Feedback labels and explanations are English.
- AI scores do not directly advance mastery; deterministic domain rules consume recorded evidence.
- Attempt, mastery event, user expression, and queue task writes are idempotent.
- Shared contracts, migrations, and root configuration remain read-only to parallel Agents.

---

### Task A1: Create and submit a practice task

**Agent:** Batch B Agent A

**Files:**

- Create: src/features/practice/practice-session.tsx
- Create: src/features/practice/practice-session.test.tsx
- Create: src/features/practice/api.ts
- Create: src/app/api/v1/practice/tasks/route.ts
- Create: src/server/repositories/attempt-repository.ts
- Test: tests/integration/practice/create-task.test.ts

**Interfaces:**

- Consumes: CandidateExpression, PracticeTask, requireUser(), AiProvider.activate().
- Produces POST /api/v1/practice/tasks with { contentId, expression, intent }.

- [ ] **Step 1: Write failing UI test**

Assert the page shows Chinese expression, English meaning, English task instruction, a Chinese response field, and Submit response. Assert no model answer appears before submission.

- [ ] **Step 2: Implement task creation route**

Validate content ownership and expression evidence, call activate(), persist practice_tasks, and return PracticeTask.

- [ ] **Step 3: Implement session form**

Require 1 through 5000 characters. Keep the draft after retryable failure. Set an idempotency key when the task opens.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/practice/practice-session.test.tsx
    pnpm test:integration -- create-task
    pnpm typecheck
    git add src/features/practice src/app/api/v1/practice src/server/repositories/attempt-repository.ts tests/integration/practice
    git commit -m "feat: add learner-first practice task"

### Task A2: Evaluate, revise, and record attempts

**Agent:** Batch B Agent A

**Files:**

- Create: src/features/practice/evaluation-panel.tsx
- Create: src/features/practice/evaluation-panel.test.tsx
- Create: src/app/api/v1/practice/attempts/route.ts
- Create: src/app/api/v1/practice/attempts/[attemptId]/revisions/route.ts
- Test: tests/integration/practice/attempts.test.ts

**Interfaces:**

- Consumes: EvaluationResult and AiProvider.evaluate().
- Produces: AttemptRecorded after a durable attempt insert.

- [ ] **Step 1: Write failing evaluation tests**

Assert separate Accuracy, Naturalness, and Context fit sections, each with 1–5 score and English feedback. Assert the learner's Chinese is preserved beside feedback.

- [ ] **Step 2: Write attempt integration tests**

Test first submission, exact idempotent retry, changed revision creating a child attempt, user B access denial, and provider failure creating no attempt.

- [ ] **Step 3: Implement routes and panel**

Evaluate first, then insert once with idempotencyKey. A revision references parent_attempt_id and uses a new idempotency key.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/practice
    pnpm test:integration -- attempts
    pnpm typecheck
    git add src/features/practice src/app/api/v1/practice tests/integration/practice
    git commit -m "feat: add evaluated practice attempts"

### Task B1: Create persistent Expression Cards

**Agent:** Batch B Agent B

**Files:**

- Create: src/features/vault/expression-card.tsx
- Create: src/features/vault/schema.ts
- Create: src/features/vault/vault-list.tsx
- Create: src/features/vault/vault-list.test.tsx
- Create: src/server/repositories/expression-repository.ts
- Create: src/app/api/v1/vault/route.ts
- Create: src/app/api/v1/vault/[userExpressionId]/route.ts
- Test: tests/integration/memory/expression-memory.test.ts

**Interfaces:**

- Consumes: AttemptRecorded fixture and CandidateExpression.
- Produces:
  - UserExpression = { id, expression, meaning, tone, function, masteryState, occurrences, attempts }
  - rememberAttempt(userId, event): Promise<UserExpression>
  - listUserExpressions(userId, filters): Promise<UserExpression[]>

- [ ] **Step 1: Write failing memory tests**

Assert first attempt creates one expression sense, occurrence, user expression, and mastery event. Exact event retry creates no duplicates. A later occurrence attaches to the same user expression while preserving both sources.

- [ ] **Step 2: Implement repository transaction**

Use unique user/expression identity and event idempotency. Never accept masteryState from the browser.

- [ ] **Step 3: Write and implement Vault tests**

English controls: Search expressions, Mastery state, and Sort. Chinese expression remains visually primary. Detail shows source, English explanation, tone, function, state evidence, and attempts.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/vault
    pnpm test:integration -- expression-memory
    pnpm typecheck
    git add src/features/vault src/server/repositories/expression-repository.ts src/app/api/v1/vault tests/integration/memory
    git commit -m "feat: add persistent Expression Vault"

### Task B2: Build Active Queue and reuse tasks

**Agent:** Batch B Agent B

**Files:**

- Create: src/features/queue/queue-list.tsx
- Create: src/features/queue/reuse-task.tsx
- Create: src/features/queue/queue-list.test.tsx
- Create: src/server/repositories/review-task-repository.ts
- Create: src/app/api/v1/queue/route.ts
- Create: src/app/api/v1/queue/[reviewTaskId]/route.ts
- Test: tests/integration/memory/active-queue.test.ts

**Interfaces:**

- Consumes: scheduleReview() and PracticeTask.
- Produces:
  - scheduleFromEvidence(userId, event): Promise<ReviewTask>
  - listDueTasks(userId, now): Promise<ReviewTask[]>

- [ ] **Step 1: Write failing scheduling integration tests**

Use fixed timestamps. Assert first tried evidence creates one due task; failed assisted reuse replaces no history but schedules an earlier pending task; successful independent reuse completes the current task and schedules the next.

- [ ] **Step 2: Implement repository**

Use unique source_mastery_event_id. Queries return only pending tasks ordered by dueAt ascending.

- [ ] **Step 3: Implement queue UI**

English labels Due now, Upcoming, Practice in a new context, and Completed. Show the Chinese target expression but no complete model response.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run src/features/queue
    pnpm test:integration -- active-queue
    pnpm typecheck
    git add src/features/queue src/server/repositories/review-task-repository.ts src/app/api/v1/queue tests/integration/memory
    git commit -m "feat: add Active Expression Queue"

### Task C1: Shared desktop states and accessibility

**Agent:** Batch B Agent C

**Files:**

- Create: src/components/states/loading-state.tsx
- Create: src/components/states/empty-state.tsx
- Create: src/components/states/error-state.tsx
- Create: src/components/states/unsupported-width.tsx
- Create: src/components/ui/chinese-text.tsx
- Create: src/styles/tokens.css
- Test: tests/accessibility/states.test.tsx
- Test: tests/accessibility/chinese-text.test.tsx

**Interfaces:**

- Produces presentational components with props only; no repository or domain imports.

- [ ] **Step 1: Write failing accessibility tests**

Assert status roles for loading, alert role and retry button for retryable error, meaningful empty-state heading, keyboard focus on new errors, and lang="zh-CN" on Chinese text spans.

- [ ] **Step 2: Implement components**

All component copy is English. ChineseText accepts children and optional pinyin but does not automatically transliterate or translate.

- [ ] **Step 3: Add desktop tokens**

Define readable Chinese font fallbacks, 1024-pixel minimum layout, focus ring, reduced motion, and contrast-safe semantic colours. Do not add mobile breakpoints or bottom navigation.

- [ ] **Step 4: Verify and commit**

Run:

    pnpm vitest run tests/accessibility
    pnpm typecheck
    git add src/components src/styles tests/accessibility
    git commit -m "feat: add accessible desktop states"

### Task I-B1: Connect AttemptRecorded to memory atomically

**Agent:** Primary Agent

**Files:**

- Create: src/server/domain/record-attempt.ts
- Modify: src/app/api/v1/practice/attempts/route.ts
- Test: tests/integration/learning-loop/record-attempt.test.ts

**Interfaces:**

- Produces recordAttempt(input): Promise<{ attempt: AttemptRecorded; userExpression: UserExpression; reviewTask: ReviewTask }>.

- [ ] **Step 1: Write failing transaction tests**

Assert one request creates attempt, mastery event, user expression, and review task. Force each repository operation to fail in turn and assert no partial committed state. Retry the same idempotency key and assert identical IDs.

- [ ] **Step 2: Implement one server-controlled transaction**

Do not emit an eventually consistent background event. Execute the full database transaction synchronously for the first release.

- [ ] **Step 3: Verify**

Run:

    pnpm test:integration -- record-attempt
    pnpm db:test
    pnpm typecheck

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

Run:

    git add src/server/domain/record-attempt.ts src/app/api/v1/practice/attempts/route.ts tests/integration/learning-loop
    git commit -m "feat: connect attempts to expression memory"

### Task I-B2: Complete the text learning-loop page

**Agent:** Primary Agent

**Files:**

- Create: src/app/(app)/import/page.tsx
- Create: src/app/(app)/practice/[taskId]/page.tsx
- Create: src/app/(app)/vault/page.tsx
- Create: src/app/(app)/queue/page.tsx
- Create: tests/e2e/text-learning-loop.spec.ts

**Interfaces:**

- Consumes all Batch A/B routes.
- Produces one navigable desktop loop.

- [ ] **Step 1: Write failing E2E test**

The seeded user signs in, imports “这也太离谱了吧。”, analyses it, selects 太离谱了, writes “这个价格也太离谱了。”, sees three feedback dimensions, revises if needed, opens Vault, and sees a due Queue item.

- [ ] **Step 2: Compose pages**

Use TanStack Query for server state and English user-visible copy. Keep retryable form input. Use role/name locators rather than CSS selectors.

- [ ] **Step 3: Verify complete loop**

Run:

    pnpm db:reset
    pnpm test:e2e -- text-learning-loop
    pnpm test:integration -- learning-loop
    pnpm verify
    pnpm build

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

Run:

    git add src/app/\(app\) tests/e2e/text-learning-loop.spec.ts
    git commit -m "feat: deliver persistent text learning loop"
