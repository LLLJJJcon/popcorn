# Revised Delivery Task 5G — Compact single-call Overview and explicit retry

## Task identity

- Plan/task: Revised Delivery, Task 5G (bounded Overview recovery requested 2026-09-05)
- Baseline commit: `8bb5cc94f0ade00c4697158d1aea309c49103883`
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn-overview`
- Branch: `codex/popcorn-overview-recovery`

## Confirmed root cause

The persisted `KJybu1Y2tyY` snapshot contains 815 native Chinese caption rows.
Their Chinese text is about 22.8 KiB, but the current Overview prompt serializes
815 repeated JSON objects and produces about 93 KiB of evidence before the
request envelope. `createOpenAiCompatibleStructuredJsonClient` correctly
rejects requests above 65,536 bytes before `fetch`, so the Overview job reached
five attempts and terminalized as `PROVIDER_OUTPUT_INVALID`. The API key and
network were not the cause.

## Product behavior

1. Generate Overview, Chapters, and Key Quotes from the complete native Chinese
   transcript with exactly one model request.
2. Build one compact prompt string made of chronological timestamped text
   blocks. Merge adjacent caption rows into each block while retaining every
   original Chinese caption string. Do not summarize, omit, sample, truncate,
   or make a preliminary Provider call.
3. Each block carries one request-local index and a compact start/end time. A
   block contains at most 24 original rows. The Provider returns exactly one
   `sourceBlockIndex` anchor for each chapter and key quote.
4. Convert each returned block anchor back to real persisted stable segment IDs
   from that block. Never expose stable IDs to the Provider and never invent or
   persist synthetic IDs. The unchanged `validateOverviewContent` grounding
   rules must still pass: the chapter timestamp is covered by referenced
   evidence and each Chinese quote occurs in referenced original evidence.
5. Bump the Overview prompt/dedupe version to `youtube-overview-v2`, so the old
   terminal v1 job does not poison the first request after this fix.
6. Keep the global 65,536-byte request limit unchanged. For an 815-row fixture
   with approximately the reported real-video scale, the complete outbound
   request must be below the limit, call `fetch` exactly once, and retain text
   from the first and last caption.
7. Add a hidden `Retry overview` action in the Overview surface. On terminal or
   public learning-artifact failure, show the action. One click creates one UUID
   retry identity, submits all Overview work once, disables/hides duplicate
   retries while in flight, and renders the normal loading/pending/success/error
   states. Do not retry automatically and do not create one request per block.
8. The server accepts an optional UUID `retryId` for Overview and includes it
   only in the semantic dedupe payload. It must not enter private Provider input,
   prompts, public results, model controls, or logs. The extension background
   forwards only the exact allowed retry ID and ignores Provider overrides.

## Interfaces consumed

- Existing `LearningArtifactEvidence` persisted rows in chronological order.
- Existing OpenAI-compatible single `chat/completions` transport and byte cap.
- Existing `createLearningArtifactJobKey`, durable registration, worker retry,
  `validateOverviewContent`, and sanitized public artifact failures.
- Existing side-panel `triggerAnalysis`, fixed Overview route, and
  `crypto.randomUUID()` pattern already used by translation retry.

## Interfaces produced

- `youtube-overview-v2` compact timestamped prompt and request-local block
  mapping.
- Optional Overview `retryId` through side panel → trusted background → fixed
  authenticated Popcorn route → dedupe payload.
- Accessible `Retry overview` button with no Provider or credential controls.

## Allowed files

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/provider.ts`
- `src/server/ai/prompts/youtube-overview.v1.ts` (delete/replace if renamed)
- `src/server/ai/prompts/youtube-overview.v2.ts` (optional replacement)
- `src/app/api/v1/youtube/[videoId]/overview/route.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `extension/background.js`
- `extension/sidepanel.html`
- `extension/sidepanel.css`
- `extension/sidepanel.js`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/delivery/task-5g-overview-compact-retry.md`

## Forbidden files

- Database, migrations, generated DB types, shared contracts, gateway settings,
  Vault/runtime resolution, worker scheduling/backoff, transcript acquisition,
  translation/explanation semantics, Saved/Practice/Progress, dependencies,
  root configuration, lockfile, `.env*`, execution ledger, and all unrelated
  Web UI files.

## TDD and expected RED evidence

Before production edits, read the TDD `writing-good-tests.md` reference and add
real behavior tests that fail for the missing behavior:

- 815 representative persisted rows currently exceed the byte cap and never
  reach `fetch`; the desired compact form stays under 65,536 bytes, includes the
  first and last Chinese captions, makes exactly one fetch, and maps one returned
  block anchor back to real stable IDs accepted by `validateOverviewContent`.
- the v2 prompt/dedupe identity is not present;
- two Overview registrations with absent versus distinct valid `retryId` values
  have different keys while private input stays identical and contains no retry
  ID;
- background does not currently forward an Overview retry UUID;
- the Overview panel lacks a hidden accessible retry action and a failed result
  cannot trigger exactly one fresh retry.

Record exact RED failures. Then implement the minimum behavior and record GREEN.
Do not weaken the request cap, output validation, stable-ID grounding, or fixed
route boundaries merely to make tests pass.

## Verification commands

```bash
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
node --test extension/tests/translation.test.js
pnpm eslint src/server/ai/openai-compatible-provider.ts src/server/ai/provider.ts src/server/ai/prompts/youtube-overview.v1.ts src/server/ai/prompts/youtube-overview.v2.ts 'src/app/api/v1/youtube/[videoId]/overview/route.ts' tests/integration/youtube/learning-artifacts.test.ts
node --check extension/background.js
node --check extension/sidepanel.js
pnpm typecheck
git diff --check
```

If one optional prompt file does not exist after the chosen rename strategy,
omit only that nonexistent path from the scoped ESLint command and record it.

## Upstream and license boundary

- YouTube Digest upstream `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`: retain the existing adapted
  `extension/sidepanel.js:triggerAnalysis`, `switchTab`, rendering, and
  `extension/background.js:requestOverview` structure; modify these functions
  in place instead of creating a parallel Overview client.
- LLM Wiki `nashsu/llm_wiki` v0.6.9 / commit
  `723e259309aea5e3850265b631f80224f66dd9f6`: no method is needed. Do not copy
  GPLv3 code, tests, prompts, components, or assets.
- Preserve existing license and provenance notices; no new dependency.

## Handoff contract

Commit only allowed files. Return status, commit SHA, exact RED/GREEN and final
verification summaries, risks, and the report path. Do not spawn subagents.
