# Popcorn Foundation and Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Create a reproducible Next.js/Supabase codebase with frozen API, domain, event, database, and security contracts for all feature modules.

**Architecture:** A single App Router project uses feature directories for browser code, Route Handlers for /api/v1, domain services for deterministic learning logic, repositories for persistence, and Supabase migrations plus RLS as the data boundary.

**Tech Stack:** Next.js, TypeScript, pnpm, Tailwind CSS, Zod, Supabase CLI, Vitest, Testing Library, Playwright.

## Global Constraints

- Desktop web only, minimum supported width 1024 pixels.
- English interface; Mandarin Chinese target language using Simplified Chinese.
- Strict TypeScript and Zod at external boundaries.
- Native language is fixed to en; target language is fixed to zh-CN.
- All user-owned records use UUID user_id and RLS.
- No product secrets in tracked files.
- Migrations and contracts are primary-Agent-owned after this plan.

---

## Planned File Map

    package.json                         scripts and dependency boundary
    src/contracts/api.ts                success/failure response envelope
    src/contracts/content.ts            content ingestion contracts
    src/contracts/analysis.ts           AI structured result contracts
    src/contracts/practice.ts           practice and evaluation contracts
    src/contracts/memory.ts             mastery and queue contracts
    src/server/domain/mastery.ts         deterministic state transitions
    src/server/domain/schedule-review.ts deterministic due-date policy
    src/server/env.ts                    server environment validation
    supabase/migrations/...              schema, indexes, RLS, pgvector
    supabase/tests/rls.sql               cross-user policy assertions
    tests/factories/                     stable module fixtures

### Task 1: Scaffold the verified application

**Files:**

- Create: package.json
- Create: pnpm-lock.yaml
- Create: tsconfig.json
- Create: next.config.ts
- Create: src/app/layout.tsx
- Create: src/app/page.tsx
- Create: src/app/globals.css
- Create: vitest.config.ts
- Create: playwright.config.ts
- Create: .env.example
- Create: .gitignore
- Test: src/app/page.test.tsx

**Interfaces:**

- Consumes: none.
- Produces: scripts dev, build, lint, typecheck, test, test:unit, test:contract, test:integration, test:e2e, verify, db:reset, and db:test.

- [ ] **Step 1: Scaffold Next.js without overwriting project documents**

Run from a temporary directory:

    pnpm create next-app@latest popcorn-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm

Expected: a new popcorn-app directory. Copy only the generated application/configuration files into the repository; preserve docs and existing report artifacts.

- [ ] **Step 2: Install the planned libraries**

Run:

    pnpm add zod @supabase/ssr @supabase/supabase-js @tanstack/react-query openai
    pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test supabase

Expected: package.json and pnpm-lock.yaml record all dependencies.

- [ ] **Step 3: Add the failing home-page test**

Create src/app/page.test.tsx:

    import { render, screen } from "@testing-library/react";
    import HomePage from "./page";

    test("describes the Chinese expression learning loop in English", () => {
      render(<HomePage />);
      expect(
        screen.getByRole("heading", {
          name: "Turn real Chinese into language you can use",
        }),
      ).toBeInTheDocument();
    });

Run:

    pnpm vitest run src/app/page.test.tsx

Expected: FAIL because the generated heading differs.

- [ ] **Step 4: Implement the minimum page and test setup**

Set src/app/page.tsx to:

    export default function HomePage() {
      return (
        <main>
          <h1>Turn real Chinese into language you can use</h1>
        </main>
      );
    }

Configure Vitest with jsdom, the @ alias, globals, and a setup file importing @testing-library/jest-dom/vitest.

Run:

    pnpm vitest run src/app/page.test.tsx
    pnpm lint
    pnpm typecheck
    pnpm build

Expected: all four commands exit 0.

- [ ] **Step 5: Commit**

Run:

    git add package.json pnpm-lock.yaml tsconfig.json next.config.ts src vitest.config.ts playwright.config.ts .env.example .gitignore
    git commit -m "build: scaffold Popcorn desktop web app"

### Task 2: Define environment and API envelopes

**Files:**

- Create: src/server/env.ts
- Create: src/contracts/api.ts
- Create: src/server/api/respond.ts
- Test: src/server/env.test.ts
- Test: src/server/api/respond.test.ts

**Interfaces:**

- Consumes: process.env.
- Produces: Env, ApiSuccess<T>, ApiFailure, success<T>(), and failure().

- [ ] **Step 1: Write failing schema and envelope tests**

Use these assertions:

    import { parseServerEnv } from "@/server/env";
    import { failure, success } from "@/server/api/respond";

    test("requires all server credentials", () => {
      expect(() => parseServerEnv({})).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    });

    test("returns stable response envelopes", async () => {
      expect(await success({ id: "item-1" }, "req-1").json()).toEqual({
        ok: true,
        data: { id: "item-1" },
        requestId: "req-1",
      });
      expect(
        await failure("VALIDATION_FAILED", "Check the form.", false, "req-2").json(),
      ).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED", retryable: false },
      });
    });

Run:

    pnpm vitest run src/server/env.test.ts src/server/api/respond.test.ts

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement exact contracts**

Define:

    export type ApiSuccess<T> = {
      ok: true;
      data: T;
      requestId: string;
    };

    export type ApiFailure = {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        fieldErrors?: Record<string, string[]>;
      };
      requestId: string;
    };

Server environment keys:

    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    OPENAI_API_KEY
    OPENAI_MODEL
    OPENAI_EMBEDDING_MODEL
    OPENAI_EMBEDDING_DIMENSIONS
    APP_URL

Set .env.example model defaults to gpt-5.6-terra, text-embedding-3-large, and 1536 embedding dimensions; leave credential values empty.

- [ ] **Step 3: Verify**

Run:

    pnpm vitest run src/server/env.test.ts src/server/api/respond.test.ts
    pnpm typecheck

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

Run:

    git add src/server/env.ts src/server/env.test.ts src/contracts/api.ts src/server/api/respond.ts src/server/api/respond.test.ts .env.example
    git commit -m "feat: define environment and API contracts"

### Task 3: Define shared domain contracts and fixtures

**Files:**

- Create: src/contracts/content.ts
- Create: src/contracts/analysis.ts
- Create: src/contracts/practice.ts
- Create: src/contracts/memory.ts
- Create: src/contracts/index.ts
- Create: tests/factories/content.ts
- Create: tests/factories/analysis.ts
- Create: tests/factories/practice.ts
- Test: tests/contract/shared-contracts.test.ts

**Interfaces:**

- Produces:
  - NormalisedContent
  - Profile
  - AnalysisResult
  - CandidateExpression
  - PracticeTask
  - EvaluationResult
  - AttemptRecorded
  - MasteryState
  - ReviewTask

- [ ] **Step 1: Write contract tests**

Assert these required examples parse:

    const content = {
      id: "00000000-0000-4000-8000-000000000001",
      sourceType: "text",
      language: "zh-CN",
      text: "这也太离谱了吧。",
      contentHash: "sha256:example",
      sourceUrl: null,
      storagePath: null,
    };

    const analysis = {
      detectedLanguage: "zh-CN",
      topic: "reaction",
      tone: "informal disbelief",
      difficulty: "B1",
      expressions: [{
        expression: "太离谱了",
        meaning: "That is way too absurd.",
        function: "strong informal reaction",
        tone: "informal",
        evidence: "这也太离谱了吧",
        confidence: 0.94,
      }],
    };

Also assert rejection when expressions is empty, contains four items, confidence exceeds 1, language is not zh-CN, or English explanation fields are empty.

Run:

    pnpm vitest run tests/contract/shared-contracts.test.ts

Expected: FAIL because contracts do not exist.

- [ ] **Step 2: Implement Zod schemas and inferred types**

Use strict objects. Define MasteryState exactly as:

    z.enum(["seen", "understood", "tried", "reused", "owned"])

Define Profile exactly as:

    {
      chineseLevel: "A2" | "B1" | "B2" | "C1";
      learningGoal: string;
      nativeLanguage: "en";
      targetLanguage: "zh-CN";
    }

Define AttemptRecorded exactly as:

    {
      attemptId: uuid;
      userExpressionId: uuid;
      taskId: uuid;
      submittedAt: ISO datetime;
      assistanceLevel: "none" | "hint" | "model_revision";
      evaluation: EvaluationResult;
    }

Define EvaluationResult with accuracy, naturalness, and contextualFit objects. Each object has score from 1 through 5 and English feedback.

- [ ] **Step 3: Add factories with stable UUIDs**

Factories accept Partial overrides and return schema-valid defaults. Do not use random data or current time.

- [ ] **Step 4: Verify**

Run:

    pnpm test:contract -- shared-contracts
    pnpm typecheck

Expected: all contract tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

Run:

    git add src/contracts tests/factories tests/contract/shared-contracts.test.ts
    git commit -m "feat: freeze shared learning contracts"

### Task 4: Create database schema, indexes, and RLS

**Files:**

- Create: supabase/config.toml
- Create: supabase/migrations/202608160001_initial_schema.sql
- Create: supabase/migrations/202608160002_rls_policies.sql
- Create: supabase/seed.sql
- Create: supabase/tests/rls.sql
- Create: src/types/database.generated.ts

**Interfaces:**

- Consumes: shared contract field names.
- Produces tables profiles, content_items, ai_runs, expression_senses, expression_occurrences, user_expressions, practice_tasks, attempts, mastery_events, review_tasks, and expression_relations.

- [ ] **Step 1: Initialize Supabase and add failing RLS assertions**

Run:

    pnpm exec supabase init

Write SQL assertions proving user A cannot select, update, or delete user B rows in profiles, content_items, user_expressions, attempts, and review_tasks.

Run:

    pnpm db:reset
    pnpm db:test

Expected: FAIL because tables and policies do not exist.

- [ ] **Step 2: Implement the schema**

Requirements:

- enable vector extension;
- UUID primary keys generated by gen_random_uuid();
- user-owned rows default user_id to auth.uid();
- profiles enforce native_language = 'en' and target_language = 'zh-CN';
- user_expressions enforce the five mastery values;
- ai_runs enforce running, succeeded, or failed;
- review_tasks enforce pending, completed, or cancelled;
- unique occurrence and idempotency keys prevent duplicate writes;
- vector column uses 1536 dimensions, matching OPENAI_EMBEDDING_DIMENSIONS passed by M4;
- created_at is timestamptz not null default now();
- state history rows are append-only.

- [ ] **Step 3: Implement RLS**

Enable RLS on every public table. Use auth.uid() = user_id for user-owned tables. For child records, use exists subqueries through their owned parent when the child does not duplicate user_id. Deny client updates and deletes to mastery_events.

- [ ] **Step 4: Seed deterministic local users and fixtures**

Seed two users with stable UUIDs and separate profiles. Seed one Chinese content item for user A and none for user B. Never use production credentials.

- [ ] **Step 5: Verify and generate types**

Run:

    pnpm db:reset
    pnpm db:test
    pnpm exec supabase gen types typescript --local > src/types/database.generated.ts
    pnpm typecheck

Expected: schema resets cleanly, all RLS assertions pass, and generated types compile.

- [ ] **Step 6: Commit**

Run:

    git add supabase src/types/database.generated.ts package.json pnpm-lock.yaml
    git commit -m "feat: add secure learning data model"

### Task 5: Implement deterministic mastery and queue rules

**Files:**

- Create: src/server/domain/mastery.ts
- Create: src/server/domain/schedule-review.ts
- Test: src/server/domain/mastery.test.ts
- Test: src/server/domain/schedule-review.test.ts

**Interfaces:**

- Produces:
  - advanceMastery(current, evidence): MasteryState
  - scheduleReview(input): { dueAt: Date; reason: string }

- [ ] **Step 1: Write mastery transition tests**

Test:

- seen plus explanation_opened becomes understood;
- understood plus assisted_attempt becomes tried;
- tried plus successful_independent_transfer becomes reused;
- reused becomes owned only after two successful independent contexts on separate dates and one due reuse;
- weak later evidence does not reduce the highest state;
- client-requested owned is not an accepted evidence type.

Run:

    pnpm vitest run src/server/domain/mastery.test.ts

Expected: FAIL because advanceMastery does not exist.

- [ ] **Step 2: Implement advanceMastery as a pure function**

The function takes current state and an evidence summary. It must not read time, database, or AI output directly.

- [ ] **Step 3: Write scheduling tests**

Use a fixed base time of 2026-08-16T00:00:00.000Z. Assert:

- first tried evidence: due in 1 day;
- failed or model_revision reuse: due in 1 day;
- successful independent reuse: due in 7 days;
- owned expression: due in 30 days.

- [ ] **Step 4: Implement scheduleReview**

Use date-fns-free UTC millisecond arithmetic to keep the rule deterministic.

- [ ] **Step 5: Verify**

Run:

    pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts
    pnpm verify
    pnpm db:test

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

    git add src/server/domain
    git commit -m "feat: add deterministic mastery and review rules"

### Task 6: Add CI and freeze the baseline

**Files:**

- Create: .github/workflows/ci.yml
- Create: docs/engineering/agent-boundaries.md
- Modify: package.json
- Test: all existing checks.

**Interfaces:**

- Produces the frozen baseline consumed by Batch A.

- [ ] **Step 1: Add CI jobs**

CI runs pnpm install --frozen-lockfile, lint, typecheck, unit and contract tests, Next.js build, Supabase start, database reset, and RLS tests. Cache pnpm only; never cache secrets or local Supabase data.

- [ ] **Step 2: Add Agent ownership rules**

Document the exact file boundaries from the orchestration plan and state that src/contracts, supabase/migrations, package.json, and root configuration are primary-Agent-owned during parallel batches.

- [ ] **Step 3: Run the complete baseline gate**

Run:

    pnpm install --frozen-lockfile
    pnpm verify
    pnpm db:reset
    pnpm db:test
    pnpm build
    git diff --check

Expected: every command exits 0.

- [ ] **Step 4: Commit**

Run:

    git add .github/workflows/ci.yml docs/engineering/agent-boundaries.md package.json pnpm-lock.yaml
    git commit -m "ci: freeze foundation verification gate"
