# Popcorn Language Desktop Web Product Design

**Date:** 2026-08-16

**Status:** Revised after user review; pending final approval

**Product:** Popcorn Language

**Delivery target:** Desktop web application

## 1. Objective

Build a deployable English-language desktop web application that helps native English speakers learning Mandarin Chinese turn useful expressions from authentic Chinese content into expressions they can reuse independently.

The delivered product must demonstrate one persistent learning loop:

1. A learner signs in and imports authentic content.
2. The system analyses the Chinese content and identifies one to three useful Chinese expressions.
3. The learner writes a personal response in Chinese using a selected expression.
4. The system evaluates accuracy, naturalness, and contextual fit.
5. The attempt and expression are saved to the learner's cloud memory.
6. The expression returns later in a new context.
7. Behavioural evidence advances the learner's mastery state and progress record.

The application must be a working full-stack product with authenticated cloud persistence, not a collection of disconnected prototype screens.

## 2. Scope

### 2.1 Included

- Desktop web application built with Next.js and TypeScript.
- English interface copy, navigation, instructions, system messages, and AI explanations.
- Mandarin Chinese learning content and learner output, using Simplified Chinese characters in the first release.
- Supabase authentication, PostgreSQL, Storage, Row Level Security, and pgvector.
- Learner profile with approximate Chinese level and learning goal; the first release fixes the native language to English and target language to Mandarin Chinese.
- Import through pasted text, public URL, and image or screenshot upload.
- Deterministic AI pipeline for content scanning, expression extraction, task activation, and response evaluation.
- Expression Vault with persistent Expression Cards and attempt history.
- Behavioural mastery states: `seen`, `understood`, `tried`, `reused`, and `owned`.
- Active Queue and due reuse tasks.
- Progress page with weekly activity, mastery distribution, and transfer evidence.
- English explanations of Chinese meaning, tone, communicative function, grammar, and contextual fit.
- Semantic duplicate detection and related-expression retrieval using pgvector.
- JSON and Markdown export of learner-owned expression data.
- Automated unit, contract, integration, security, and browser-level tests.
- Vercel deployment, production Supabase configuration, and a seeded demonstration account.

### 2.2 Explicitly excluded

- Native iOS or Android applications.
- Mobile-specific page layouts, bottom navigation, gesture design, or touch-first interaction.
- Progressive Web App installation, service workers, or offline mode.
- URL ingestion that bypasses paywalls, authentication, robots restrictions, or technical access controls.
- Large-scale crawling or redistribution of copyrighted content.
- A full beginner curriculum, live classes, social community, or marketplace.
- Japanese or another selectable target-language flow.
- Chinese-language interface localisation.
- Open-ended autonomous agents that decide product workflow.
- Microservices, FastAPI, Redis, background worker infrastructure, or a separate vector database.

### 2.3 Desktop support boundary

- Primary viewport: desktop browsers at 1280x720 and above.
- Minimum supported viewport width: 1024 pixels.
- Supported current browser families: Chrome, Edge, Firefox, and Safari.
- Narrower viewports may show a clear unsupported-layout message; they are not a first-release acceptance target.

## 3. Product Principles

1. **Learner responds first.** AI may guide, explain, and revise, but must not replace the learner's first attempt with a complete answer.
2. **Evidence advances mastery.** A learner cannot manually mark an expression as owned.
3. **One to three expressions per item.** The system prioritises quality and relevance over exhaustive extraction.
4. **Memory compounds across sessions.** Saved expressions, attempts, and due tasks must be recoverable after sign-out and on another computer.
5. **AI is bounded by contracts.** Every model response is schema-validated, versioned, and recoverable.
6. **Chinese is the learning target.** Interface guidance and explanations are in English; authentic input, extracted expressions, practice prompts, and learner output are in Mandarin Chinese.
7. **Demo stability is a product requirement.** Known inputs may use versioned cached AI results when the provider is unavailable.

## 4. Architecture

### 4.1 Runtime architecture

The product uses one Next.js application for the desktop user interface and server-side API routes. Next.js Route Handlers expose versioned `/api/v1` endpoints. Supabase provides authentication, PostgreSQL, Storage, Row Level Security, and pgvector. AI capabilities are accessed only through a server-side provider adapter so provider keys and prompts never reach the browser.

```text
Desktop Browser
    |
    | Next.js pages + typed API client
    v
Next.js Route Handlers (/api/v1)
    |-- authentication and authorisation
    |-- domain services and mastery transitions
    |-- AI pipeline orchestration
    |-- export and demo-safe caching
    |
    +--> Supabase Auth / PostgreSQL / Storage / pgvector
    |
    +--> AI Provider Adapter
```

### 4.2 Application boundaries

- The browser owns presentation state, form state, navigation, and server-state caching.
- Route Handlers own authentication checks, input validation, status codes, and response envelopes.
- Domain services own mastery transitions, queue scheduling, deduplication, and progress calculations.
- Repositories own database queries and must always operate under an authenticated user context.
- The AI pipeline owns model calls, prompt versions, schema validation, retry decisions, and result caching.
- Supabase policies provide a second enforcement boundary so application bugs cannot expose another user's records.

### 4.3 API response contract

Every `/api/v1` endpoint returns one of two envelopes:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
};
```

Domain packages may not depend on React components or Route Handler request objects. Shared contracts are versioned in one package and may be modified only through a reviewed contract change.

## 5. Module Design

## M0. Engineering Foundation

**Purpose:** Establish the shared repository, tooling, code boundaries, and continuous verification used by every later module.

**Responsibilities:**

- Next.js App Router and strict TypeScript configuration.
- Tailwind CSS and a small desktop component foundation based on shadcn/ui.
- ESLint, formatting, unit testing, Playwright, environment validation, and CI.
- Feature-oriented source directories and import-boundary rules.
- Shared error, logging, request ID, and test-fixture conventions.
- Local Supabase configuration and migration commands.

**Produces:** A clean application that builds, tests, and serves a minimal authenticated shell without product behaviour.

**Dependency:** None.

## M1. Data Model, Contracts, and Security

**Purpose:** Freeze the shared language that allows independent feature Agents to work without editing the same core files.

**Responsibilities:**

- Database migrations and generated database types.
- Zod schemas for API input, output, and AI structured results.
- Domain identifiers, enums, and event contracts.
- Row Level Security and Storage ownership policies.
- Mastery transition table and queue scheduling rules.
- API error codes and export format version.

**Produces:** Reviewed migrations, shared contracts, RLS tests, and fixture builders.

**Dependencies:** M0.

## M2. Identity, Profile, and Web Shell

**Purpose:** Give every learner an isolated cloud identity and a stable desktop application frame.

**Responsibilities:**

- Sign-up, sign-in, sign-out, password reset, and session restoration.
- Protected routes and server-side user resolution.
- Learner profile editing.
- Fixed English-native and Mandarin-Chinese-target language context, plus editable Chinese level and learning goal.
- Desktop navigation for Home, Import, Vault, Queue, and Progress.
- First-run onboarding and profile completion gate.
- Account export and deletion entry points.

**Produces:** A learner can sign in on another computer and recover the same profile.

**Dependencies:** M1 contracts, profile schema, and RLS.

## M3. Content Ingestion and Normalisation

**Purpose:** Convert supported user input into one safe, traceable content representation for the AI pipeline.

**Responsibilities:**

- Pasted-text form and validation.
- Public URL fetch with timeouts, content-type allowlist, size limits, and readable-text extraction.
- Screenshot or image upload to user-isolated Supabase Storage.
- Normalised text, source metadata, content hash, and import status.
- Clear handling for inaccessible, unsupported, empty, or oversized content.
- User guidance about sensitive and copyrighted content.

**Produces:** `NormalisedContent` records with stable IDs and hashes.

**Dependencies:** M1 content contracts, storage policies, and content tables.

## M4. AI Analysis and Evaluation Pipeline

**Purpose:** Provide predictable language analysis and feedback behind stable typed interfaces.

**Responsibilities:**

- Provider adapter for text, image, structured output, and embeddings without exposing provider-specific types to callers.
- Scan stage for detected language, topic, tone, and approximate difficulty.
- Extract stage returning one to three candidate expressions with meaning, function, tone, evidence span, and confidence.
- Activate stage creating a response task tied to learner intent and level.
- Evaluate stage returning separate accuracy, naturalness, and contextual-fit feedback.
- Prompt version, model version, duration, token usage, and status recording.
- Zod validation, bounded retry, failure persistence, and versioned result cache.
- Fixed evaluation fixtures for prompt regression checks.

**Produces:** Typed analysis and evaluation services usable without knowledge of the AI vendor.

**Dependencies:** M1 AI schemas, run tables, and error taxonomy. It consumes M3 output after integration but can be built against fixtures.

## M5. Use It Now Practice Loop

**Purpose:** Turn one selected expression into an immediate learner-generated response and actionable feedback.

**Responsibilities:**

- Analysis results and expression selection.
- Response-task presentation without showing a complete model answer first.
- Draft submission, evaluation display, revision, and resubmission.
- Clear distinction between accuracy, naturalness, and contextual fit.
- Attempt history for the current task.
- Domain event emission when valid evidence is created.

**Produces:** A complete import-to-feedback interaction and durable `AttemptRecorded` evidence.

**Dependencies:** M2 authenticated shell, M3 content ingestion, M4 analysis and evaluation, and M1 event contracts.

## M6. Expression Memory and Active Queue

**Purpose:** Convert attempts into durable learner memory and create a reason to return.

**Responsibilities:**

- Automatic Expression Card creation and duplicate-safe updates.
- Vault list, search, filters, and expression detail.
- Original occurrence, meaning, tone, function, examples, and attempt history.
- Evidence-driven mastery state transitions.
- Queue scheduling, due tasks, completion, and rescheduling.
- Reuse tasks that place an expression in a new context.
- JSON and Markdown export.

**Produces:** Cross-session Vault persistence and a due reuse task that can advance an expression from `tried` to `reused`.

**Dependencies:** M1 memory contracts and transition rules, M4 embeddings, and M5 attempt events.

## M7. Progress, Semantic Relations, and Chinese Learning Quality

**Purpose:** Make accumulated Chinese capability visible and ensure semantic features respect Chinese expression boundaries, tone, register, and context.

**Responsibilities:**

- Weekly completed attempts, due-task completion, and independent reuse counts.
- Mastery-state distribution and transition history.
- Transfer evidence shown separately from simple activity volume.
- pgvector duplicate suggestions and related expressions by communicative function.
- Expression Health Check for stalled expressions.
- Chinese expression normalisation that preserves meaningful character, word, phrase, and regional distinctions.
- English explanations that remain grounded in the original Chinese evidence span.
- Mandarin Chinese fixtures covering informal speech, online language, polite requests, disagreement, reactions, and common ambiguity.

**Produces:** A trustworthy Progress page, useful semantic relationships between Chinese expressions, and an end-to-end Chinese learning demonstration for English-speaking learners.

**Dependencies:** M6 durable evidence and queues, M4 embeddings, and M2 profile language settings.

## M8. Desktop Web Experience and Accessibility

**Purpose:** Make the application coherent, usable, and reliable during ordinary use and live assessment.

**Responsibilities:**

- Desktop page composition and consistent navigation.
- Shared loading, empty, success, warning, and error presentations.
- Keyboard navigation, focus management, labels, contrast, and reduced-motion support.
- Browser compatibility at the supported desktop viewport boundary.
- Long-text, multi-script, slow-network, and AI-failure presentation.
- Demo-safe error messages that explain recovery without exposing internal details.

**Produces:** A consistent desktop experience across all product modules.

**Dependencies:** M0 component primitives and M1 error contract. It may build against fixtures while M5 and M6 are in progress.

## M9. Integration, Quality, Deployment, and Demonstration

**Purpose:** Prove that the modules form one reliable product in production-like conditions.

**Responsibilities:**

- Contract and migration compatibility checks.
- Full integration of Chinese content, AI, attempts, memory, queue, and progress.
- End-to-end browser scenarios and cross-user isolation tests.
- Vercel deployment and production Supabase configuration.
- Seeded demo account with existing Vault, progress history, and a due transfer task.
- Versioned cached AI responses for known demo inputs.
- Backup, restore rehearsal, observability, and presentation checklist.

**Produces:** A deployed URL and a repeatable live demonstration from any supported desktop browser.

**Dependencies:** M2 through M8.

## 6. Core Data Model

The initial database contains the following ownership-scoped records:

| Entity | Purpose | Key relationships |
|---|---|---|
| `profiles` | Learner preferences and language configuration | One per authenticated user |
| `content_items` | Imported text, URL, or image metadata | Owned by user; source for occurrences |
| `ai_runs` | Versioned scan, extraction, evaluation, and embedding runs | References content or attempt |
| `expression_senses` | Canonical expression meaning, tone, and function | Language-scoped; referenced by occurrences |
| `expression_occurrences` | Expression evidence within imported content | Links content to expression sense |
| `user_expressions` | Learner-specific Expression Card and current mastery | Links user to expression sense |
| `practice_tasks` | Immediate or reuse task with context and due state | Links user expression and source context |
| `attempts` | Learner response, support level, feedback, and revision | Links task and user expression |
| `mastery_events` | Append-only evidence and state transition history | Links attempt and user expression |
| `review_tasks` | Active Queue schedule and completion status | One scheduling record per due action |
| `expression_relations` | Semantic or functional relationship | Links two expression senses |

All user-owned tables include `user_id`, creation time, update time where relevant, and policies preventing cross-user reads or writes. State history is append-only; current state on `user_expressions` is a projection maintained by a domain service, not a client-provided value.

## 7. Mastery and Queue Rules

### 7.1 Mastery evidence

- `seen`: a candidate expression was presented to the learner.
- `understood`: the learner inspected the explanation or correctly completed a comprehension check.
- `tried`: the learner submitted an original response using the expression with assistance allowed.
- `reused`: the learner used the expression successfully in a later or different context without a complete answer being supplied.
- `owned`: the learner produced successful independent evidence across at least two distinct contexts on separate occasions, including one due reuse task.

Transitions are monotonic in the first release. A weak later attempt creates new evidence and a new review task but does not silently erase historical achievement. The Progress page must distinguish recent performance from highest demonstrated mastery.

### 7.2 Queue scheduling

- New `tried` evidence schedules an initial reuse task.
- Failed or heavily assisted reuse schedules an earlier retry.
- Successful independent reuse schedules a later transfer task.
- Queue rules are deterministic and unit tested; AI may generate task content but may not choose the mastery transition or due date.

## 8. Primary Data Flows

### 8.1 Import to first attempt

1. The authenticated learner submits text, URL, or image.
2. M3 validates and stores a `content_items` record.
3. M4 scans the normalised content and extracts candidates.
4. The learner selects one candidate.
5. M4 creates a response-task payload using the profile and content context.
6. M5 records the learner's response and requests evaluation.
7. M5 stores the attempt and emits `AttemptRecorded` in the same server-controlled transaction boundary.
8. M6 creates or updates the Expression Card, appends mastery evidence, and schedules the next task.

### 8.2 Due reuse task

1. M6 queries due Chinese review tasks for the signed-in learner.
2. The learner opens a task containing a new context but not a complete answer.
3. M5 records and evaluates the independent response.
4. M6 applies deterministic transition rules and reschedules if needed.
5. M7 recalculates progress from persisted evidence.

### 8.3 AI cache and recovery

1. M4 constructs a cache key from content hash, task type, prompt version, model version, and relevant language profile fields.
2. A valid cached success is returned without a new model call.
3. An uncached request creates an `ai_runs` row with `running` status.
4. Schema-valid output is stored as `succeeded`; invalid or provider-failed output is stored as `failed` with a safe error category.
5. Retry is bounded and idempotent. The user may retry a failed step without duplicating content, attempts, mastery evidence, or queue records.

## 9. Error Handling and Safety

### 9.1 Error categories

- `AUTH_REQUIRED` and `FORBIDDEN` for identity and ownership failures.
- `VALIDATION_FAILED` for form, API, and structured-output failures.
- `CONTENT_UNAVAILABLE`, `CONTENT_UNSUPPORTED`, and `CONTENT_TOO_LARGE` for ingestion failures.
- `AI_TEMPORARILY_UNAVAILABLE`, `AI_OUTPUT_INVALID`, and `AI_RATE_LIMITED` for model failures.
- `CONFLICT` for duplicate or stale state transitions.
- `INTERNAL_ERROR` for unexpected failures identified by request ID.

### 9.2 Recovery behaviour

- Forms retain safe user input after recoverable failures.
- Retrying an operation uses an idempotency key.
- Partial AI failures do not advance mastery.
- Cached demo inputs remain usable if the AI provider is unavailable.
- URL import never falls back to unsafe scraping behaviour.
- Image access uses signed URLs and user-isolated storage paths.
- Server logs exclude raw sensitive content by default.

## 10. Testing Strategy

### 10.1 Unit tests

- Mastery transitions and queue scheduling.
- Content normalisation, hashing, limits, and URL allowlist behaviour.
- API and AI Zod schemas.
- Progress aggregation and Chinese expression normalisation.
- Cache keys, retry policy, and idempotency.

### 10.2 Contract tests

- Route Handler envelopes and error codes.
- Provider adapter fixtures for scan, extract, activate, evaluate, and embeddings.
- Database generated types against migration state.
- Shared event payload compatibility between M5 and M6.

### 10.3 Integration and security tests

- Authenticated database operations under RLS.
- Storage upload and signed retrieval.
- Import-to-attempt-to-memory transaction behaviour.
- Duplicate submission and retry safety.
- Two test users cannot read or mutate each other's profile, content, expressions, attempts, queue, or progress.

### 10.4 Browser tests

- Sign in and profile restoration.
- Text, URL, and screenshot import.
- Analysis, selection, response, feedback, and revision.
- Vault persistence after sign-out and sign-in.
- Due task completion and progress update.
- English interface guidance with Chinese content, expression, and response rendering.
- Export and account deletion confirmation.
- Supported desktop viewports and keyboard-only critical path.

### 10.5 AI evaluation fixtures

A small version-controlled fixture set covers Mandarin Chinese tone and register differences, ambiguity, online slang, regional caveats, weak learner responses, and unsafe or malformed model output. Expected explanations are written in English. Prompt changes must pass schema, regression, and human-readable snapshot review before integration.

## 11. Multi-Agent Development Design

### 11.1 Coordination rules

- The primary Agent owns planning, shared contracts, integration, reviews, and full-suite verification.
- At most three implementation Agents work concurrently, matching the available concurrency slots while preserving one slot for coordination.
- Each Agent owns a bounded module and an explicit file set.
- Parallel Agents must not edit shared contracts, database migrations, root configuration, or another module's files.
- Required shared-contract changes return to the primary Agent as a proposal before implementation continues.
- Every Agent returns changed files, commands run, test results, unresolved risks, and any requested contract change.
- Parallel work starts only from a verified shared baseline and ends at an integration checkpoint.

### 11.2 Sequential foundation

The following work is strictly sequential:

1. M0 engineering foundation.
2. M1 data model, API contracts, RLS, event contracts, and fixtures.
3. Baseline build, unit tests, migration reset, and RLS tests.

No feature Agent starts before these interfaces pass review.

### 11.3 Parallel batch A

After M1 is frozen:

- **Agent A:** M2 Identity, Profile, and Web Shell.
- **Agent B:** M3 Content Ingestion and Normalisation.
- **Agent C:** M4 AI Analysis and Evaluation Pipeline using fixed content fixtures.
- **Primary Agent:** Reviews contract compliance and prepares integration tests without changing feature-owned files.

These modules are independent because they consume M1 contracts and do not require each other's implementation.

### 11.4 Integration checkpoint A

The primary Agent integrates M2, M3, and M4 and verifies:

- A signed-in learner can store and retrieve content.
- Normalised content satisfies the AI pipeline contract.
- AI results remain isolated to the owning user.
- Full build, migration, unit, contract, and RLS suites pass.

This checkpoint is sequential.

### 11.5 Parallel batch B

After checkpoint A:

- **Agent A:** M5 Use It Now Practice Loop.
- **Agent B:** M6 Expression Memory and Active Queue, initially consuming reviewed `AttemptRecorded` fixtures.
- **Agent C:** M8 Desktop Web Experience and Accessibility using existing feature fixtures and stories.
- **Primary Agent:** Owns the real M5-to-M6 event integration and prevents shared UI or contract conflicts.

M5 and M6 may proceed in parallel only because M1 freezes their event payload. Their real event connection is integrated sequentially by the primary Agent.

### 11.6 Integration checkpoint B

The primary Agent verifies the complete text-import vertical slice:

`sign in -> import -> analyse -> select -> respond -> evaluate -> save -> queue`

This checkpoint includes retry and duplicate-submission tests and is sequential.

### 11.7 Parallel batch C

After the core evidence loop is stable:

- **Agent A:** M7 Progress aggregation and Expression Health Check.
- **Agent B:** M7 pgvector deduplication and related-expression retrieval.
- **Agent C:** M7 Chinese-language quality fixtures, English-explanation checks, and browser scenarios for mixed-script rendering.
- **Primary Agent:** Runs the complete suite, reviews query cost and data isolation, and integrates the three M7 submodules.

The M7 submodules use separate service, query, and test files. Shared migrations are created sequentially by the primary Agent before this batch begins.

### 11.8 Sequential delivery

M9 is coordinated sequentially because deployment, seed data, migrations, caching, and end-to-end tests share the same environment and production state. Individual Agents may investigate independent failures in parallel, but only the primary Agent applies final integration decisions and declares the build ready.

## 12. File Ownership Boundaries

The implementation plan will assign exact paths, but the intended ownership is:

```text
src/app/                         Primary Agent for shared layouts and routes
src/features/auth/               M2 owner
src/features/profile/            M2 owner
src/features/content/            M3 owner
src/features/analysis/           M4 owner
src/features/practice/           M5 owner
src/features/vault/              M6 owner
src/features/queue/              M6 owner
src/features/progress/           M7 progress owner
src/features/relations/          M7 semantic owner
src/features/chinese/            M7 Chinese-language quality owner
src/components/ui/               M0/M8 owner; reviewed shared changes only
src/server/api/                  Primary Agent owns shared routing conventions
src/server/ai/                   M4 owner
src/server/domain/               Primary Agent owns shared domain contracts
src/server/repositories/         Module owner by repository file
src/contracts/                   Primary Agent only
supabase/migrations/             Primary Agent only during parallel batches
supabase/tests/                  Primary Agent with module-specific additions
tests/e2e/                       M9 owner; feature Agents may propose scenarios
```

## 13. Acceptance Criteria

The desktop web product is complete when all of the following are true:

1. A learner can sign in on a supported desktop browser and recover the same profile and learning history on another computer.
2. Text, one supported public URL, and a screenshot can each produce a stored content item and a schema-valid analysis.
3. Analysis identifies one to three expressions with meaning, tone, function, and evidence from the source.
4. The learner can submit and revise a personal response and receive separate accuracy, naturalness, and contextual-fit feedback.
5. A successful attempt creates a persistent Expression Card, mastery evidence, and a due task without duplicate records.
6. A later reuse attempt in a new context can advance mastery according to deterministic rules.
7. Vault, Queue, and Progress are derived from authenticated persistent data rather than browser-only state.
8. The interface, instructions, and AI explanations are in English while authentic content, extracted expressions, practice prompts, and learner responses are correctly rendered and evaluated in Simplified Chinese.
9. RLS tests prove cross-user isolation for every user-owned data group.
10. AI failures are visible, retryable where safe, and do not corrupt mastery state.
11. The seeded demo account contains history, progress, and a due transfer task.
12. The final demonstration succeeds from the deployed URL in a supported desktop browser.
13. Unit, contract, integration, security, and required Playwright tests pass from a clean checkout.

## 14. Implementation Planning Constraints

The subsequent implementation plans must:

- Be organised by the modules and integration checkpoints in this design, not by calendar week.
- Use test-driven steps and independently reviewable deliverables.
- Specify exact files, interfaces, commands, expected failures, and expected passing results.
- Preserve the sequential foundation and integration gates.
- Assign parallel tasks only where file ownership and shared state do not overlap.
- Treat M0 and M1 as the first implementation plan before feature Agents are dispatched.
- Keep mobile UI, PWA, offline mode, and native applications outside all task lists.
