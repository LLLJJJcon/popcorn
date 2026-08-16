# Foundation Task 2 Brief

## Controller assignment

- Canonical plan: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 2.
- Canonical design: `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md`.
- Baseline commit: `b1739e0e229e48a54f0cbb8eae96fc236c8b00bd`.
- Assigned branch: `codex/popcorn-foundation-2`.
- Assigned worktree: `/private/tmp/popcorn-foundation-2`.
- Handoff report: `docs/engineering/handoffs/foundation/task-2.md`.
- Required commit subject: `feat: freeze YouTube learning contracts`.

## Resolved contract decision

The user confirmed on 2026-08-17 that the canonical design's complete error taxonomy governs where the Task 2 snippet is narrower. `ApiFailure.error.code` must include `UNSUPPORTED_YOUTUBE_PAGE`, `TRANSCRIPT_EMPTY`, and `SYNC_RETRYING` in addition to every code listed in the Task 2 snippet. This is a deliberate resolution, not optional scope.

## Ownership boundary

Allowed changes are limited to this brief, the required handoff, every file declared by Task 2, and `.env.example` as required by Step 4. This is a controller-authorized one-task assignment to create the shared contract files; after Foundation freezes, only the controller may change them.

Forbidden changes: `package.json`, `pnpm-lock.yaml`, all other root configuration; `extension/**`; `scripts/**`; `third_party/**`; existing plans/specs; `docs/engineering/execution-ledger.md`; `supabase/**`; `src/types/**`; any database migration; Task 1 application/provenance files; and user report/demo artifacts.

## Interfaces and acceptance boundary

- Consumes: fixed native language `en`, target language `zh-CN`, six YouTube-only save kinds, five durable job kinds, and the resolved API error taxonomy.
- Produces exactly the interfaces named below, strict Zod validation, deterministic test factories, server environment validation, and stable success/failure response helpers.
- Expected RED: `CI=true pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts` must fail because the contracts, environment module, and response helpers do not exist. Capture the actual missing-module/behavior failure before production implementation.
- Required GREEN: the same focused command passes, then `CI=true pnpm typecheck`, `CI=true pnpm lint`, and `git diff --check` exit 0. Run the complete available contract suite once before commit.
- Reject arbitrary/non-YouTube URLs, missing exact acted-on quote/explanation/selection fields, non-English explanations where required, candidate arrays over three, and mastery values other than `tried|reused|owned`.
- Do not implement authentication, persistence, database tables, RLS, provider calls, jobs, UI, generic inputs, pgvector, graph, export, or later-task behavior.

## Upstream and license contract

- YouTube Digest: no implementation code is reused in this task; shared Popcorn contracts are independently defined from the approved design. Do not edit vendored files.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6`: no implementation or method adaptation is required here. Do not copy GPLv3 code, tests, prompts, components, assets, or naming-specific structure.
- No new third-party license artifact is required. Existing MIT attribution must remain untouched.

## TDD and handoff protocol

Follow `superpowers:test-driven-development`: tests first, observed expected RED, minimal GREEN, and refactor only while green. The handoff must use the runbook structure and record changed files, exact RED/GREEN output, broader verification, interfaces, upstream/license disposition, contract requests, and unresolved risks. Commit the brief, implementation, tests, and handoff together, then return only status, commit SHA, one-line verification summary, concerns, and report path.

### Task 2: Define environment, API, source, knowledge, and learning contracts

**Files:**

- Create: `src/server/env.ts`
- Create: `src/contracts/api.ts`
- Create: `src/contracts/source.ts`
- Create: `src/contracts/knowledge.ts`
- Create: `src/contracts/practice.ts`
- Create: `src/contracts/memory.ts`
- Create: `src/contracts/index.ts`
- Create: `src/server/api/respond.ts`
- Create: `tests/factories/source.ts`
- Create: `tests/factories/practice.ts`
- Test: `tests/contract/shared-contracts.test.ts`
- Test: `src/server/env.test.ts`
- Test: `src/server/api/respond.test.ts`

**Interfaces:**

- Consumes: product-spec field names and fixed `en`/`zh-CN` language boundary.
- Produces: `ApiSuccess<T>`, `ApiFailure`, `VideoSource`, `VideoSnapshot`, `TranscriptSegment`, `SavedItem`, `SavedItemInput`, `GeneratedArtifact`, `KnowledgeJob`, `CandidateExpression`, `PracticeTask`, `EvaluationResult`, `AttemptRecorded`, `MasteryState`, and `ReviewTask`.

- [ ] **Step 1: Write failing API and source-contract tests**

Use these required assertions:

```ts
expect(SavedItemInputSchema.parse({
  clientEventId: "00000000-0000-4000-8000-000000000101",
  youtubeVideoId: "dQw4w9WgXcQ",
  kind: "subtitle_selection",
  capturedAt: "2026-08-16T10:00:00.000Z",
  startSeconds: 42,
  endSeconds: 48,
  originalChinese: "这也太离谱了吧。",
  englishTranslation: "That is way too absurd.",
  segmentIds: ["seg-42"],
  startOffset: 0,
  endOffset: 9,
  contextBefore: ["你刚才看到了吗？"],
  contextAfter: ["我完全没想到。"],
})).toMatchObject({ kind: "subtitle_selection" });

expect(MasteryStateSchema.options).toEqual(["tried", "reused", "owned"]);
```

Also assert rejection of arbitrary URLs, missing exact quote text, more than three candidates, non-English explanations, and `seen` or `understood` mastery.

Run:

```bash
pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts
```

Expected: FAIL because contracts do not exist.

- [ ] **Step 2: Implement stable API envelopes and errors**

```ts
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = {
  ok: false;
  error: {
    code: "AUTH_REQUIRED" | "SESSION_EXPIRED" | "FORBIDDEN" |
      "INVALID_YOUTUBE_VIDEO" | "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" |
      "TRANSCRIPT_UNAVAILABLE" | "SYNC_QUEUE_FULL" |
      "IDEMPOTENCY_CONFLICT" | "PROVIDER_RATE_LIMITED" |
      "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID" |
      "JOB_LEASE_CONFLICT" | "JOB_RETRY_EXHAUSTED" |
      "VALIDATION_FAILED" | "CONFLICT" | "INTERNAL_ERROR";
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
};
```

- [ ] **Step 3: Implement strict Zod domain contracts**

Define exact enums:

```ts
export const SavedItemKindSchema = z.enum([
  "video", "player_moment", "subtitle_row", "subtitle_selection",
  "key_quote", "ai_explanation",
]);
export const SavedItemStatusSchema = z.enum([
  "saved", "resolving_source", "organizing", "ready", "unsupported", "failed",
]);
export const KnowledgeJobStatusSchema = z.enum([
  "pending", "leased", "succeeded", "retryable_failed", "terminal_failed",
]);
export const KnowledgeJobTypeSchema = z.enum([
  "resolve_snapshot", "generate_overview", "translate_segments",
  "explain_selection", "analyze_saved_item",
]);
export const MasteryStateSchema = z.enum(["tried", "reused", "owned"]);
```

`SavedItemInputSchema` must use a discriminated union so `key_quote` requires `exactQuote`, `ai_explanation` requires `selectedChinese` plus `englishExplanation`, and subtitle selections require stable segment IDs and character offsets.

`CandidateExpressionSchema` requires Simplified Chinese expression, English meaning, English explanation, tone, communicative function, register, exact evidence text, segment IDs, timestamp range, and confidence `0..1`.

- [ ] **Step 4: Define server environment requirements**

Require:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPADATA_API_KEY
OPENAI_API_KEY
OPENAI_MODEL
APP_URL
EXTENSION_REDIRECT_ORIGIN
INTERNAL_JOB_SECRET
```

Do not include an embedding model or dimensions. `.env.example` leaves credentials empty and documents that no provider key enters the extension.

- [ ] **Step 5: Add deterministic factories and verify**

Factories use fixed UUIDs, ISO dates, YouTube IDs, and Chinese fixtures; they never use randomness or current time.

```bash
pnpm vitest run tests/contract/shared-contracts.test.ts src/server/env.test.ts src/server/api/respond.test.ts
pnpm typecheck
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/contracts src/server/env.ts src/server/env.test.ts src/server/api tests/factories tests/contract/shared-contracts.test.ts .env.example
git commit -m "feat: freeze YouTube learning contracts"
```
