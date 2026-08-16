# Popcorn Batch B Saved Knowledge and Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn durable YouTube saves into source-grounded knowledge, learner-first practice, Expression Cards, and deterministic future Practice.

**Architecture:** A durable server job pipeline resolves snapshots and generated artifacts without changing raw saves. The web organizes saves by video; only a learner-selected expression followed by a valid attempt creates knowledge and mastery evidence.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL/RLS/Cron, OpenAI server adapter, Zod, TanStack Query, Vitest, Testing Library, Playwright.

## Global Constraints

- Batch A exit gate must be green.
- Raw `saved_items` are durable before any provider operation.
- Generated artifacts are versioned by source hash, saved-item hash, prompt version, and model version.
- `nashsu/llm_wiki@v0.6.9`, peeled commit `723e259309aea5e3850265b631f80224f66dd9f6`, contributes method ideas only; no GPLv3 code may be copied.
- The adapted method is Raw Source -> Structured Knowledge -> Learning Evidence.
- Candidate analysis returns one to three expressions from saved evidence, never a whole-video Vault import.
- Vault creation requires a valid original learner attempt.
- Mastery and due dates are deterministic; AI cannot set either.
- Web navigation is `Home`, `Saved`, `Practice`, `Vault`, `Progress`.

## Method Provenance

| LLM Wiki reference at `723e259309aea5e3850265b631f80224f66dd9f6` | Popcorn adaptation | Prohibited implementation |
|---|---|---|
| `llm-wiki.md`, three-layer Raw Sources/Wiki/Schema pattern | `video_snapshots`, `transcript_segments`, and exact `saved_items` remain immutable. | Markdown/Obsidian filesystem source layer |
| `README.md`, “Two-Step Chain-of-Thought Ingest” | analyze a saved item, then update expression knowledge only after practice | Copying ingest source, prompts, or desktop runtime |
| `README.md`, “Source traceability” | expression occurrence links to saved item, transcript segment, and timestamp | `sources[]`/`[[wikilink]]` implementation |
| `README.md`, “SHA256 incremental cache” and “Persistent ingest queue” | versioned artifact/result keys and leased durable jobs | queue code, filesystem cache, or LanceDB/vector pipeline |
| `README.md`, “Review System (Async Human-in-the-Loop)” | ambiguous merges remain user-confirmed candidates | Review components, action code, or prompts |

### Task 1: Extend and harden the durable knowledge-job processor

**Files:**

- Create: `src/server/jobs/job-types.ts`
- Modify: `src/server/jobs/process-jobs.ts`
- Modify: `src/server/jobs/handlers/resolve-snapshot.ts`
- Modify: `src/server/jobs/handlers/generate-overview.ts`
- Create: `src/server/jobs/handlers/analyze-saved-item.ts`
- Create: `src/server/jobs/provider-cache.ts`
- Modify: `src/app/api/internal/jobs/process/route.ts`
- Test: `tests/integration/jobs/process-jobs.test.ts`
- Test: `tests/integration/jobs/recovery.test.ts`

**Interfaces:**

- Consumes: frozen `KnowledgeJob`, lease rules, transcript/AI adapters, and the Batch A processor/handlers.
- Produces: hardened `processJobBatch({limit, now}): JobBatchResult`, deterministic provider caching, and the added `analyze_saved_item` handler while preserving Batch A's snapshot/overview/translation/explanation handlers.

**Upstream reuse:** Retain and harden the Batch A adaptation of YouTube Digest `background.js:pollTranscriptJob` in `resolve-snapshot.ts`; preserve completed/failed/queued/active handling and job-expiry awareness. Reuse timestamp validation ideas from `background.js:validateAndFixTimestamps` in generated-artifact validation. Do not copy any LLM Wiki implementation.

- [ ] **Step 1: Write failing lease/recovery integration tests**

Prove the processor leases a bounded batch, scopes every operation to the job user, recovers an expired lease, does not double-apply a result, marks retryable provider errors with backoff, and leaves raw saves untouched after terminal failure.

- [ ] **Step 2: Implement the authenticated internal endpoint**

Require `Authorization: Bearer <INTERNAL_JOB_SECRET>`, reject public sessions, lease at most five jobs, and return counts rather than full transcript/provider bodies.

- [ ] **Step 3: Harden snapshot resolution and artifact idempotency**

Re-test the Batch A fetch/poll path under concurrent duplicate jobs; validate actual language, compute transcript hash, keep one immutable snapshot revision, insert stable segments idempotently, and attach unresolved saved moments by timestamp. Mark unsupported sources without deleting saves. Add deterministic cache/result keys to every existing handler.

- [ ] **Step 4: Implement saved-item analysis**

Saved-item analysis produces one to three candidate expressions with exact segment evidence. Keep the existing Overview contract of complete chapters and three to five timestamp-grounded quotes. Store all schema-valid artifacts under deterministic result keys.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/integration/jobs/process-jobs.test.ts tests/integration/jobs/recovery.test.ts
pnpm typecheck
pnpm db:test
git add src/server/jobs src/app/api/internal/jobs/process tests/integration/jobs
git commit -m "feat: process durable knowledge jobs"
```

### Task 2: Build Home and the video-grouped Saved library

**Files:**

- Create: `src/features/home/next-action.tsx`
- Create: `src/features/saved/api.ts`
- Create: `src/features/saved/video-card.tsx`
- Create: `src/features/saved/saved-timeline.tsx`
- Create: `src/features/saved/processing-state.tsx`
- Create: `src/app/(app)/home/page.tsx`
- Create: `src/app/(app)/saved/page.tsx`
- Create: `src/app/(app)/saved/[videoSourceId]/page.tsx`
- Create: `src/app/api/v1/saved/route.ts`
- Create: `src/app/api/v1/saved/[videoSourceId]/route.ts`
- Test: `src/features/saved/saved-timeline.test.tsx`
- Test: `tests/integration/saved/video-library.test.ts`

**Interfaces:**

- Consumes: video source, latest snapshot, saved items, generated artifacts, and candidate artifacts.
- Produces: `SavedVideoSummary`, `SavedVideoDetail`, and one Home next action.

- [ ] **Step 1: Write failing grouping and progressive-state tests**

Assert seven moments from one video produce one card; timeline ordering uses timestamp then capture time; raw text stays visible during `organizing` or `failed`; unsupported state explains native Simplified Chinese requirement; Home prefers due Practice over unsorted saves.

- [ ] **Step 2: Implement user-scoped Saved queries**

Return no full transcript in list responses. Detail returns metadata, bounded transcript evidence for saved items, overview/chapters/quotes, generated translations already stored, candidates, and processing errors safe for users.

- [ ] **Step 3: Implement pages and one-action hierarchy**

Home shows one primary CTA. Saved list groups by video. Detail renders timestamp order, links back to canonical YouTube time, permits ignoring/deleting/practicing individual saves, and never forces processing all saves.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run src/features/saved/saved-timeline.test.tsx tests/integration/saved/video-library.test.ts
pnpm typecheck
git add src/features/home src/features/saved src/app/'(app)'/home src/app/'(app)'/saved src/app/api/v1/saved tests/integration/saved
git commit -m "feat: add the Saved video library"
```

### Task 3: Confirm candidate knowledge with source traceability

**Files:**

- Create: `src/features/saved/candidate-expression.tsx`
- Create: `src/features/saved/candidate-list.tsx`
- Create: `src/server/domain/confirm-candidate.ts`
- Create: `src/server/repositories/expression-repository.ts`
- Create: `src/app/api/v1/saved-items/[savedItemId]/candidates/route.ts`
- Test: `src/features/saved/candidate-list.test.tsx`
- Test: `tests/integration/knowledge/source-traceability.test.ts`

**Interfaces:**

- Consumes: schema-valid candidate artifact tied to saved item and segments.
- Produces: a selected candidate payload for immediate practice; it does not yet create `user_expressions`.

- [ ] **Step 1: Write failing evidence and ambiguity tests**

Assert every candidate shows exact Chinese, English meaning, tone, function, source text, timestamp, and video link. Two candidates with uncertain semantic identity remain distinct. Selecting one creates a practice draft only; no Vault or mastery row appears.

- [ ] **Step 2: Implement candidate presentation**

Show at most three candidates and one `Use It Now` action per candidate. Confidence is not shown as false precision; low-confidence candidates display `Needs your confirmation`.

- [ ] **Step 3: Implement source-grounded confirmation**

Validate candidate artifact ownership and version. Return exact evidence IDs with the practice draft. Do not ask AI to decide duplicate identity at this step.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run src/features/saved/candidate-list.test.tsx tests/integration/knowledge/source-traceability.test.ts
git add src/features/saved src/server/domain/confirm-candidate.ts src/server/repositories/expression-repository.ts src/app/api/v1/saved-items tests/integration/knowledge
git commit -m "feat: confirm source-grounded expression candidates"
```

### Task 4: Implement Use It Now evaluation and revision

**Files:**

- Create: `src/features/practice/practice-session.tsx`
- Create: `src/features/practice/evaluation-panel.tsx`
- Create: `src/features/practice/api.ts`
- Create: `src/server/ai/prompts/activate.v1.ts`
- Create: `src/server/ai/prompts/evaluate.v1.ts`
- Create: `src/server/domain/create-practice-task.ts`
- Create: `src/server/repositories/attempt-repository.ts`
- Create: `src/app/(app)/practice/[taskId]/page.tsx`
- Create: `src/app/api/v1/practice/tasks/route.ts`
- Create: `src/app/api/v1/practice/attempts/route.ts`
- Create: `src/app/api/v1/practice/attempts/[attemptId]/revisions/route.ts`
- Test: `src/features/practice/practice-session.test.tsx`
- Test: `tests/integration/practice/attempts.test.ts`

**Interfaces:**

- Consumes: confirmed candidate, learner profile, exact occurrence evidence.
- Produces: `PracticeTask`, schema-valid `EvaluationResult`, attempts, revisions, and `AttemptRecorded` event.

**Upstream reuse:** Adapt timestamp/source-grounding and structured-output discipline from YouTube Digest `prompts/explain.md` and `prompts/note-cleanup.md`; do not copy its English-note-cleanup goal. Prompts must explain Mandarin in English and never supply a complete answer before the first submission.

- [ ] **Step 1: Write failing learner-first tests**

Assert the task includes the expression and goal but no model answer; empty/English-only responses fail validation; evaluation has separate 1-5 accuracy, naturalness, and contextual-fit scores with English feedback; revision preserves attempt history.

- [ ] **Step 2: Implement task activation**

Generate a bounded Chinese response situation appropriate to profile level and candidate function. Persist task context before showing it.

- [ ] **Step 3: Implement evaluation and revision**

Schema-validate output, persist provider run metadata, allow bounded retry, keep learner text after recoverable failure, and never create mastery evidence for a failed/invalid provider result.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run src/features/practice/practice-session.test.tsx tests/integration/practice/attempts.test.ts
pnpm typecheck
git add src/features/practice src/server/ai/prompts src/server/domain/create-practice-task.ts src/server/repositories/attempt-repository.ts src/app/'(app)'/practice src/app/api/v1/practice tests/integration/practice
git commit -m "feat: add learner-first Chinese practice"
```

### Task 5: Atomically create Expression Cards, mastery, and due Practice

**Files:**

- Create: `src/server/domain/record-valid-attempt.ts`
- Create: `src/server/repositories/review-task-repository.ts`
- Create: `src/features/vault/expression-card.tsx`
- Create: `src/features/vault/vault-list.tsx`
- Create: `src/features/practice/due-practice.tsx`
- Create: `src/app/(app)/vault/page.tsx`
- Create: `src/app/(app)/practice/page.tsx`
- Create: `src/app/api/v1/vault/route.ts`
- Create: `src/app/api/v1/vault/[userExpressionId]/route.ts`
- Create: `src/app/api/v1/practice/due/route.ts`
- Test: `tests/integration/learning-loop/record-valid-attempt.test.ts`
- Test: `tests/integration/memory/vault-practice.test.ts`

**Interfaces:**

- Consumes: valid `AttemptRecorded`, selected candidate, occurrence evidence, mastery/schedule pure functions.
- Produces: expression sense, occurrence, user expression at `tried`, mastery event, and one due review task in one transaction.

- [ ] **Step 1: Write failing atomicity tests**

Assert a save alone produces none of these records. A valid first attempt creates all records exactly once. Replaying an attempt event is idempotent. A failure rolls back the entire learning-evidence transaction without deleting the attempt draft.

- [ ] **Step 2: Implement normalized expression lookup**

Use exact normalized Simplified Chinese first, then trigram suggestions for user confirmation; do not silently merge uncertain senses. Attach every occurrence to saved item, transcript segment, and timestamp.

- [ ] **Step 3: Implement transactional evidence recording**

Only the server calls `advanceMastery` and `scheduleReview`. The client cannot submit a target mastery state or due date.

- [ ] **Step 4: Implement Vault and user-facing Practice**

Vault shows learned expressions, original occurrences, meanings, tone, function, attempt history, and current mastery. Practice shows due tasks and uses that label instead of Queue.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/integration/learning-loop/record-valid-attempt.test.ts tests/integration/memory/vault-practice.test.ts
pnpm db:test
git add src/server/domain/record-valid-attempt.ts src/server/repositories src/features/vault src/features/practice src/app/'(app)'/vault src/app/'(app)'/practice src/app/api/v1/vault src/app/api/v1/practice/due tests/integration
git commit -m "feat: record expression mastery atomically"
```

### Task 6: Prove the complete Saved-to-Practice loop

**Files:**

- Create: `tests/e2e/saved-learning-loop.spec.ts`
- Create: `tests/contract/ai/saved-analysis.test.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `docs/engineering/execution-ledger.md`

**Interfaces:**

- Consumes: Tasks 1-5.
- Produces: `saved item -> organized candidate -> original response -> evaluation -> tried -> due Practice` integration gate.

- [ ] **Step 1: Add the failing browser scenario**

Sign in with seeded user, open Home, follow recent-save CTA, open one video, inspect exact evidence, select one candidate, submit an original response, revise it, verify Vault `tried`, and verify one due Practice task. Assert ignored saves remain untouched.

- [ ] **Step 2: Add AI regression fixtures**

Cover informal reaction, polite request, disagreement, online slang, register ambiguity, malformed output, and evidence text not present in saved context. A candidate with invented evidence must fail schema/domain validation.

- [ ] **Step 3: Run the Batch B gate**

```bash
pnpm vitest run tests/integration/jobs tests/integration/saved tests/integration/knowledge tests/integration/practice tests/integration/learning-loop tests/integration/memory
pnpm vitest run tests/contract/ai/saved-analysis.test.ts
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/saved-learning-loop.spec.ts tests/contract/ai/saved-analysis.test.ts src/app/'(app)'/layout.tsx docs/engineering/execution-ledger.md
git commit -m "test: prove Saved-to-Practice learning loop"
```

## Batch B Exit Gate

Do not start Batch C until:

- durable jobs recover after lease expiry and never mutate raw saves;
- one video groups all saves and raw material remains visible during failures;
- every candidate is grounded in exact source evidence;
- selection alone creates no Vault or mastery row;
- original response, evaluation, revision, and attempt persistence work;
- one valid attempt atomically creates expression knowledge, `tried`, and due Practice;
- LLM Wiki provenance remains method-only with no copied GPLv3 code;
- complete integration, browser, RLS, build, and AI fixture gates pass.
