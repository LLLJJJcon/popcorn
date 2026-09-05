# Revised Delivery Task 5G — Compact Overview and explicit retry handoff

## Scope and root cause

Implemented the Task 5G recovery at baseline `d4893353d9c8b7b007e94fef96775714e0ac4dfa`.
The failure was local and deterministic: 815 persisted Chinese caption rows were
serialized as 815 repeated JSON records, exceeding the unchanged 65,536-byte
OpenAI-compatible request bound before `fetch` ran. Overview also had no
separate retry identity, so a terminal v1 dedupe result could not be explicitly
re-registered.

Only the brief's allowed files changed. No database, migration, worker/backoff,
gateway, dependency, lockfile, or unrelated UI change was made.

## Delivered behavior

- Overview is versioned as `youtube-overview-v2`.
- Adjacent chronological persisted rows are grouped into request-local blocks of
  at most 24 rows. The outbound prompt contains each complete original Chinese
  caption exactly once as compact timestamped text, not repeated JSON keys or
  stable IDs.
- The Provider receives exactly one Overview completion request. Its strict
  response contract now has one `sourceBlockIndex` for every chapter and key
  quote. That anchor maps internally to the real stable IDs from the referenced
  block, then existing `validateOverviewContent` remains the grounding gate.
- The fixed Overview route accepts an optional UUID `retryId`; it changes only
  the semantic dedupe payload and never private job input or Provider input.
- The existing background `requestOverview` forwards only `snapshotId` and the
  optional retry UUID to the fixed authenticated route, ignoring Provider
  controls.
- The Overview panel has an initially hidden accessible `Retry overview`
  button. A terminal/public failure reveals it; one click creates one UUID,
  hides/disables duplicate actions while in flight, uses the normal Overview
  loading/pending/success/error path, and does not retry automatically.

## TDD record

### RED

1. `pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts`
   initially failed the new 815-caption test with
   `ModelGatewayError: PROVIDER_OUTPUT_INVALID` from the request-byte guard
   before `fetch`, and the Overview retry test returned `[202, 400, 400]`
   because `retryId` was rejected.
2. `node --test extension/tests/translation.test.js` initially failed because
   `retryOverviewBtn`, `triggerAnalysis`, and `retryOverview` did not exist.
3. The focused background retry regression was run with the Overview retry
   forwarding temporarily absent; it failed because the outgoing body omitted
   the UUID.

### GREEN

The 815-caption fixture now stays below 65,536 bytes, includes its first and
last Chinese caption, invokes `fetch` once, and passes stable-ID grounding
after block-anchor mapping. The route and extension regressions confirm that
distinct valid Overview retry IDs create distinct dedupe keys while private
input is identical and credential/Provider controls are absent.

## Final verification

All commands were run after the final change:

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts  # 67 passed
node --test extension/tests/translation.test.js                       # 47 passed
pnpm eslint src/server/ai/openai-compatible-provider.ts src/server/ai/provider.ts src/server/ai/prompts/youtube-overview.v1.ts 'src/app/api/v1/youtube/[videoId]/overview/route.ts' tests/integration/youtube/learning-artifacts.test.ts  # passed
node --check extension/background.js                                  # passed
node --check extension/sidepanel.js                                   # passed
pnpm typecheck                                                        # passed (`tsc --noEmit`)
git diff --check                                                      # passed
```

## Risks

- No real Provider egress was performed; the deterministic byte-cap, request
  count, prompt privacy, and output-grounding paths are covered by the local
  integration fixture.
- Model output that names an unknown/out-of-range block remains sanitized as
  `PROVIDER_OUTPUT_INVALID`; it cannot create synthetic stable IDs.

## Fix round 1 — independent review findings

### RED

The review regressions were added before their production changes.

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
# 67 tests: 1 failed
# grounds each Overview anchor to one prompt-visible caption line across timestamp gaps
# ModelGatewayError: PROVIDER_OUTPUT_INVALID

node --test extension/tests/translation.test.js
# 47 tests: 45 passed, 2 failed
# a late Overview response for video A cannot overwrite video B or release B loading
#   received A overview where currentAnalysis had to remain null for B
# a pending Overview retry resumes its owner-bound job when the Overview tab is re-entered
#   continuation omitted retryId and jobId
```

### GREEN

- Prompt blocks now retain compact per-line index and exact start/end times.
  The strict Provider result includes exactly one block and line anchor per
  chapter/quote; it maps to one real stable ID and runs the unchanged grounding
  validator against that exact persisted line.
- Overview request ownership now combines a monotonic generation with video and
  snapshot IDs. A stale request cannot render, cache, change retry UI, or clear
  the active request's loading state.
- A pending Overview request retains its owner-bound `retryId` and `jobId`.
  Re-entering Overview continues that durable job through the existing message
  path; success, terminal failure, and a new digest clear the retained state.

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts  # 67 passed
node --test extension/tests/translation.test.js                       # 47 passed
```
