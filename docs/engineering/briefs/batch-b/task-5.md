# Batch B Task 5 — atomic learning evidence, Vault, and due Practice

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`
- Task: 5, **Atomically create Expression Cards, mastery, and due Practice**.
- Baseline: `a4a8241`.
- Branch: `codex/popcorn-batch-b-5`.
- Worktree: `/private/tmp/popcorn-batch-b-5`.
- Frozen database dependency: CONTRACT-013 through `a4a8241`.

Implement only Task 5. Start with failing tests and record RED evidence before
implementation. Commit code plus `docs/engineering/handoffs/batch-b/task-5.md` and
return the commit SHA, focused results, risks, and handoff path.

## Allowed files

Create:

- `src/server/domain/record-valid-attempt.ts`
- `src/server/repositories/review-task-repository.ts`
- `src/features/vault/expression-card.tsx`
- `src/features/vault/vault-list.tsx`
- `src/features/practice/due-practice.tsx`
- `src/app/(app)/vault/page.tsx`
- `src/app/(app)/practice/page.tsx`
- `src/app/api/v1/vault/route.ts`
- `src/app/api/v1/vault/[userExpressionId]/route.ts`
- `src/app/api/v1/practice/due/route.ts`
- `tests/integration/learning-loop/record-valid-attempt.test.ts`
- `tests/integration/memory/vault-practice.test.ts`
- `docs/engineering/handoffs/batch-b/task-5.md`

Modify only as needed for real Task 4 integration:

- `src/server/repositories/attempt-repository.ts`
- `src/features/practice/practice-session.tsx`
- `src/features/practice/practice-session.test.tsx`
- `tests/integration/practice/attempts.test.ts`

All other files are forbidden. In particular, do not modify migrations, pgTAP,
generated database types, shared contracts, root configuration, lockfile, CI,
ledger, gateway/Vault-secret/Provider transport, prompts, Saved/Task 1/Task 3,
`src/app/(app)/layout.tsx`, extension files, or existing routes.

## Product boundary

- Popcorn remains for English-native learners of Mandarin and only source-grounded
  YouTube learning snapshots.
- A save, candidate selection, failed original, or revision alone creates no Vault,
  mastery, or review row.
- Only a passed revision-1 original response may become `tried`.
- Mastery remains exactly `tried -> reused -> owned`; this task only creates `tried`.
- User-facing copy says `Practice`, never `Queue`.
- Do not add generic text/URL/image/screenshot input, pgvector, knowledge graph,
  chat retrieval, export, advanced Progress, or silent sense merging.
- This task makes no Provider call beyond the existing Task 4 activation/evaluation
  flow. Vault and due-Practice reads and promotion retries perform zero egress.

## Frozen interfaces consumed

Use the generated RPC exactly:

```ts
promote_valid_practice_draft_attempt({
  p_user_id,
  p_practice_draft_attempt_id,
  p_normalized_expression_text,
  p_due_at,
  p_interval_days,
})
```

Use, do not duplicate:

```ts
advanceMastery(null, { kind: "valid_original_attempt" }) // "tried"
scheduleReview({ kind: "first_tried", now: stagedAttempt.submittedAt })
```

Also consume the frozen Task 4 `PracticeDraftRecord`,
`PracticeDraftAttemptRecord`, `AttemptRecorded`, repository, and HTTP service.
Do not emulate the database transaction with separate inserts.

## Interface produced

`record-valid-attempt.ts` should expose a small provider-neutral service boundary:

```ts
type PracticePromotionResult = {
  expressionSenseId: string;
  occurrenceId: string;
  userExpressionId: string;
  practiceTaskId: string;
  attemptId: string;
  masteryEventId: string;
  reviewTaskId: string;
  created: boolean;
};

type PracticePromotionRepository = {
  promote(input: {
    userId: string;
    practiceDraftAttemptId: string;
    normalizedExpressionText: string;
    dueAt: string;
    intervalDays: 1;
  }): Promise<PracticePromotionResult>;
};
```

Derive the normalized expression only from the server-loaded draft target using
`NFKC` plus Unicode trim, then validate it through the existing bounded target
Chinese schema. Confirm `advanceMastery` yields `tried`; derive due/interval only
through `scheduleReview(first_tried)`. Never accept client mastery, due, interval,
owner, candidate evidence, or normalization authority.

## Durable staging and retry recovery

The exact order is mandatory:

1. Existing Task 4 evaluates the original response.
2. Persist `practice_draft_attempts` first; it is the recovery anchor.
3. If and only if the stored attempt is passed revision 1, call the frozen RPC.
4. Return HTTP 201 only after promotion succeeds. A promotion error remains
   retryable and must not delete or rewrite the staged attempt.

An original POST replay must load revision 1 by exact owner + draft before any
Provider resolution:

- same `responseChinese`: zero Provider calls; replay promotion if passed, or return
  the same failed attempt without promotion;
- different response: conflict; never overwrite original evidence;
- completed draft plus the same original: replay the receipt and return the same
  attempt/canonical identities;
- an insert `23505` race: reload revision 1 and apply the same exact-content rule.

This recovers termination after staging and termination after promotion without a
new queue. No API key, origin, request body, prompt, raw output, or Provider error
may appear in the promotion input, output, Vault DTO, Practice DTO, UI, or logs.

Optional revisions must continue to work after a passed original completes the
draft. They remain append-only feedback history and do not create another mastery
event or reschedule the initial review. A failed original followed by a passing
revision still does not qualify for Vault under CONTRACT-013.

## Vault and due Practice

Every service-role query must include the authenticated `user_id`; a missing/mixed
owner relation fails closed. Keep results bounded and deterministically ordered.

`GET /api/v1/vault` and `/vault`:

- show only promoted `user_expressions`, never saves/drafts alone;
- show expression, English meaning/explanation, tone, communicative function,
  register, current mastery, original occurrence evidence/timestamp/video link,
  and attempt history;
- provide an empty state for a learner with no valid original attempt.

`GET /api/v1/vault/[userExpressionId]`:

- return the exact owner card or 404-equivalent public failure;
- include bounded possible-match suggestions: exact normalized text first, then a
  deterministic application-side Chinese trigram similarity over a bounded owner
  candidate set; suggestions are display-only and never auto-merge or write.

`GET /api/v1/practice/due` and `/practice`:

- show only the owner’s `pending` tasks with `due_at <= server now`;
- order by due time then stable ID;
- return review task ID, user expression ID, expression/meaning/mastery, due time,
  and interval; accept no client due/mastery input.

The existing `PracticeSession` should preserve learner text and show a clear Vault
entry after a passed response. It must still support optional revision.

## Required RED/GREEN tests

Before implementation, prove the new test imports/behaviors fail. At minimum cover:

- save/draft/failed original/passing revision 2 produce no promotion;
- passed revision 1 derives `tried` and one-day schedule and sends the exact RPC;
- client payload cannot influence mastery/due/normalization;
- RPC failure leaves the staged attempt recoverable;
- same original replay before/after RPC completion makes zero Provider calls,
  returns the same attempt, and does not duplicate promotion;
- different original replay conflicts; insertion race reloads exact revision 1;
- optional revision remains available after completed original but never promotes;
- Vault save-only exclusion, owner isolation, exact evidence/history/provenance-safe
  mapping, bounded deterministic suggestions, and no silent merge;
- due Practice pending/due/owner filtering and deterministic order;
- production pages and three GET routes use the real runtime/repository path;
- UI retains text, displays feedback, passed Vault entry, empty states, and never
  exposes forbidden secret/private/Provider fields.

## Verification

Run only the proportionate Task 5 gate:

```bash
./node_modules/.bin/vitest run \
  tests/integration/learning-loop/record-valid-attempt.test.ts \
  tests/integration/memory/vault-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/features/practice/practice-session.test.tsx
./node_modules/.bin/tsc --noEmit --pretty false
fixed-test-environment ./node_modules/.bin/next build --webpack
git diff --check
```

Use the explicit fixed environment recorded in existing Batch B handoffs if the
`fixed-test-environment` helper is unavailable. Do not repeat database reset/full
pgTAP/full application/browser suites: CONTRACT-013 already passed 570/570,
two-session concurrency, types, and build, and this task may not change shared files.

## Upstream and license

- YouTube Digest: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. No specified upstream file/function
  applies to this owner-scoped promotion/Vault UI. Do not create a parallel
  transcript/video extraction implementation.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`. Method-only influence is limited to
  `Raw Source -> Structured Knowledge -> Learning Evidence`. Copy no GPLv3 code,
  tests, prompts, components, assets, wording, or styling.
- Preserve existing notices; add no dependency or lockfile change.

## Review handoff

Commit only the allowlist. Report RED/GREEN evidence, exact route/page production
wiring, retry semantics, focused results, build/type/diff results, residual risk,
and the handoff path. A new read-only review Agent must inspect the full baseline
diff before controller integration.
