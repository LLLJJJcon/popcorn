# Popcorn Desktop Web Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Coordinate the complete desktop web implementation through contract-first sequential foundations, three bounded parallel batches, and sequential integration gates.

**Architecture:** One Next.js App Router application exposes versioned Route Handlers and uses Supabase for identity, PostgreSQL, Storage, RLS, and pgvector. OpenAI calls are isolated behind a server adapter using the Responses API, structured outputs, image input, and a separate embedding endpoint.

**Tech Stack:** Next.js, TypeScript, pnpm, Tailwind CSS, shadcn/ui, Zod, TanStack Query, Supabase, OpenAI JavaScript SDK, Vitest, Testing Library, Playwright, Vercel.

## Global Constraints

- Desktop web only; support 1024-pixel and wider viewports.
- All interface copy, instructions, system messages, and AI explanations are English.
- Authentic content, extracted expressions, practice prompts, and learner responses are Mandarin Chinese in Simplified Chinese characters.
- The first release is for native English speakers learning Mandarin Chinese.
- No mobile-specific interface, PWA, service worker, offline mode, native app, microservice, Redis, FastAPI, or background worker.
- All user-owned database records include user_id and are protected by RLS.
- AI output is schema-validated, versioned, cached, retry-bounded, and never allowed to decide mastery transitions.
- Use OpenAI Responses API through a provider adapter. Set the deploy-time model through OPENAI_MODEL; begin evaluation with gpt-5.6-terra and use text-embedding-3-large with 1536 configured dimensions for Chinese/English semantic relations.
- Never commit secrets. Commit .env.example with variable names only.
- Follow TDD: failing focused test, observed failure, minimal implementation, focused pass, broader pass, commit.
- Shared contracts, migrations, root configuration, and integration routes are owned by the primary Agent.
- Each parallel implementation Agent works in an isolated Git worktree and named branch; parallel Agents never share one writable checkout.
- The primary Agent maintains committed handoff reports, docs/engineering/execution-ledger.md, and integration checkpoints; chat messages are not the progress record.

---

## Plan Set

1. Foundation and contracts:
   docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md
2. Parallel batch A:
   docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md
3. Parallel batch B:
   docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md
4. Parallel batch C:
   docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md
5. Delivery:
   docs/superpowers/plans/2026-08-16-popcorn-delivery-demo.md
6. Execution and recovery runbook:
   docs/superpowers/plans/2026-08-16-popcorn-execution-runbook.md

## Dependency Graph

    Foundation M0
        -> Contracts, schema, RLS M1
            -> Batch A
               Agent A: identity/profile/shell M2
               Agent B: content ingestion M3
               Agent C: AI pipeline M4
            -> Integration Gate A
            -> Batch B
               Agent A: Use It Now M5
               Agent B: Vault/Queue M6
               Agent C: desktop experience M8
            -> Integration Gate B
            -> Batch C
               Agent A: Progress
               Agent B: pgvector relations
               Agent C: Chinese quality fixtures
            -> Integration Gate C
            -> Delivery M9

## Shared Baseline Protocol

- [ ] **Step 1: Primary Agent creates an execution branch**

Run:

    git switch -c feat/popcorn-desktop-web

Expected: branch feat/popcorn-desktop-web is active.

- [ ] **Step 2: Primary Agent verifies the approved design and plan set**

Run:

    test -f docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md
    test -f docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md
    test -f docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md
    test -f docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md
    test -f docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md
    test -f docs/superpowers/plans/2026-08-16-popcorn-delivery-demo.md

Expected: exit code 0.

- [ ] **Step 3: Primary Agent completes foundation and contracts**

Execute every task in the foundation plan sequentially. Do not dispatch feature Agents before pnpm verify and pnpm db:test both pass.

- [ ] **Step 4: Record the frozen interface commit**

Run:

    git rev-parse HEAD
    git branch -f integration/batch-a-base HEAD

Expected: a commit hash and branch integration/batch-a-base at the same commit. Include both in every Batch A Agent prompt.

## Parallel Batch A Dispatch

Dispatch all three Agents from the same frozen interface commit. At execution time use the superpowers:using-git-worktrees workflow to create branches agent/batch-a-auth, agent/batch-a-content, and agent/batch-a-ai from integration/batch-a-base.

### Agent A assignment: identity, profile, and shell

Scope:

- src/features/auth/**
- src/features/profile/**
- src/app/(auth)/**
- src/app/(app)/**
- tests/e2e/auth-profile.spec.ts

Do not modify:

- src/contracts/**
- src/server/domain/**
- supabase/migrations/**
- package.json
- root configuration

Return:

- changed files
- focused and broad test output
- requested contract changes
- user-visible limitations

### Agent B assignment: content ingestion

Scope:

- src/features/content/**
- src/server/repositories/content-repository.ts
- src/app/api/v1/content/**
- tests/integration/content/**

Do not modify the shared contracts, migrations, root configuration, or another feature directory.

### Agent C assignment: AI pipeline

Scope:

- src/server/ai/**
- src/features/analysis/**
- src/server/repositories/ai-run-repository.ts
- tests/contract/ai/**

Do not hard-code a model outside src/server/ai/model-config.ts. Do not place OpenAI types in src/contracts.

## Integration Gate A

- [ ] **Step 1: Review each Agent diff independently**

Run for each returned commit:

    git show --stat --oneline agent/batch-a-auth
    git diff integration/batch-a-base..agent/batch-a-auth --name-only

Expected: only the assigned files plus explicitly approved test fixtures.

- [ ] **Step 2: Integrate commits one at a time**

Run:

    git cherry-pick agent/batch-a-auth
    pnpm verify
    git cherry-pick agent/batch-a-content
    pnpm verify
    git cherry-pick agent/batch-a-ai
    pnpm verify

Expected: every command exits 0. The three named Agent branches resolve to the reviewed returned commits.

- [ ] **Step 3: Verify platform integration**

Run:

    pnpm db:reset
    pnpm db:test
    pnpm test:integration -- content-analysis
    pnpm build

Expected: database reset succeeds, RLS and integration tests pass, and Next.js build exits 0.

## Parallel Batch B Dispatch

Create a new baseline hash after Gate A.

### Agent A assignment: Use It Now

Scope:

- src/features/practice/**
- src/server/repositories/attempt-repository.ts
- src/app/api/v1/practice/**
- tests/integration/practice/**

Consumes the frozen AnalysisResult, PracticeTask, EvaluationResult, and AttemptRecorded contracts.

### Agent B assignment: Vault and Active Queue

Scope:

- src/features/vault/**
- src/features/queue/**
- src/server/repositories/expression-repository.ts
- src/server/repositories/review-task-repository.ts
- tests/integration/memory/**

Develop against committed AttemptRecorded fixtures. The primary Agent connects the real event after both Agents return.

### Agent C assignment: desktop experience

Scope:

- src/components/ui/**
- src/components/states/**
- src/styles/**
- tests/accessibility/**

Do not change feature domain behaviour. Provide components through props and English copy.

## Integration Gate B

- [ ] **Step 1: Integrate and verify the three Agent commits**

Use the same one-at-a-time cherry-pick and pnpm verify protocol from Gate A.

- [ ] **Step 2: Primary Agent connects practice evidence to memory**

Modify only:

- src/server/domain/record-attempt.ts
- src/app/api/v1/practice/attempts/route.ts
- tests/integration/learning-loop/record-attempt.test.ts

Required transaction:

    evaluate response
      -> insert attempt once
      -> append mastery event once
      -> upsert user expression
      -> schedule review task once

- [ ] **Step 3: Verify the complete text vertical slice**

Run:

    pnpm test:integration -- learning-loop
    pnpm test:e2e -- text-learning-loop
    pnpm verify

Expected: all commands exit 0 and the E2E test observes a persisted Vault card and due task after a response.

## Parallel Batch C Dispatch

### Agent A assignment: Progress

Scope:

- src/features/progress/**
- src/server/repositories/progress-repository.ts
- tests/integration/progress/**

### Agent B assignment: semantic relations

Scope:

- src/features/relations/**
- src/server/repositories/relation-repository.ts
- tests/integration/relations/**

The primary Agent creates the pgvector migration before dispatch.

### Agent C assignment: Chinese quality

Scope:

- src/features/chinese/**
- tests/fixtures/chinese/**
- tests/contract/ai/chinese-*.test.ts
- tests/e2e/chinese-rendering.spec.ts

This Agent may change prompts only through a versioned file under src/server/ai/prompts and must provide before/after fixture evidence.

## Integration Gate C

- [ ] **Step 1: Integrate Batch C one commit at a time**

Run pnpm verify after each cherry-pick.

- [ ] **Step 2: Verify progress and semantic integrity**

Run:

    pnpm db:reset
    pnpm test:integration -- progress relations
    pnpm test:contract -- chinese
    pnpm test:e2e -- chinese-rendering

Expected: all commands exit 0.

- [ ] **Step 3: Run the full pre-delivery gate**

Run:

    pnpm verify
    pnpm db:test
    pnpm test:e2e

Expected: zero failing checks.

## Sequential Delivery

Execute the delivery plan with the primary Agent. Independent failing test files may be investigated in parallel, but deployments, migrations, seed data, and demo cache changes remain sequential.

## Definition of Ready for an Agent Task

An Agent task is dispatchable only when:

- the baseline commit is named;
- consumed contract signatures are present in the assigned plan;
- file ownership does not overlap another active Agent;
- fixtures exist for unavailable neighbouring modules;
- exact focused test command and acceptance result are stated.

## Definition of Done for an Agent Task

An Agent task is acceptable only when:

- the diff is within assigned paths;
- the focused test failed before implementation and passes afterward;
- pnpm typecheck and relevant broader tests pass;
- no secrets, skipped tests, unfinished copy, or unreviewed contract changes exist;
- the Agent reports changed files, commands, results, risks, and commit hash.

## Documentation Sources

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase local migrations: https://supabase.com/docs/guides/local-development/overview
- Supabase CLI workflow and RLS: https://supabase.com/docs/guides/local-development/cli-workflows
- OpenAI model guidance: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI embedding model for English and non-English text: https://developers.openai.com/api/docs/models/text-embedding-3-large
- Playwright test isolation and user-visible locators: https://playwright.dev/docs/best-practices
