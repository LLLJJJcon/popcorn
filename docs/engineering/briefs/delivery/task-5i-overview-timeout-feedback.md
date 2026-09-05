# Delivery Task 5I — Overview timeout and visible progress

## Identity

- Plan: revised local-first Delivery live-smoke recovery.
- Task: 5I — Overview timeout and visible progress.
- Baseline commit: `31c2019b774896780ac291e41c0fcab589994313`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn-overview-timeout`.
- Branch: `codex/popcorn-overview-timeout`.

## Evidence and purpose

The real `generate_overview` job `41166f24-556c-4fa7-88a0-93c34645f361`
was created successfully and claimed by the local worker. Four attempts ended as
`PROVIDER_UNAVAILABLE`. During the same interval, five
`translate_segments` jobs using the same active `qwen3.8-flash` gateway and
credential succeeded on their first attempts. An unauthenticated connectivity
probe reached `https://aihubmix.com/v1/models` through the configured local
proxy in under one second, while direct connectivity timed out. The fourth
Overview attempt remained leased beyond 21 seconds and failed after the
Provider adapter's existing 30-second request timeout window. The resulting
durable backoff reached eight minutes. This evidence isolates the problem to
the larger single Overview completion exceeding the generic 30-second request
budget; it does not indicate an expired API key or broken proxy.

## Required behavior

1. Keep the approved Overview design: the complete persisted transcript is one
   compact prompt, one Provider completion request, with the unchanged 65,536
   byte request cap and exact block/line grounding.
2. Give only Overview completions a default timeout of exactly `120_000` ms.
   Translation, selection explanation, and other structured JSON completions
   retain the existing default `30_000` ms timeout.
3. Preserve the existing generic `timeoutMs` test/configuration seam. Add only
   the smallest separate Overview timeout seam needed for deterministic tests;
   do not add a user setting or environment variable.
4. While Overview is running or remains pending, replace the inert
   `Overview will appear here` text with concise visible progress that tells the
   learner generation can take about two minutes. It must not claim failure or
   suggest repeated clicks.
5. Existing explicit retry, durable `jobId`/`retryId` resumption,
   stale-video/generation ownership fence, failure copy, and button visibility
   remain unchanged.
6. Do not shorten or alter database retry/backoff policy in this task. Do not
   create parallel jobs or any extra Provider call.

## File ownership

Allowed implementation/test files:

- `src/server/ai/openai-compatible-provider.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `extension/sidepanel.html`
- `extension/sidepanel.js`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/delivery/task-5i-overview-timeout-feedback.md`

Forbidden:

- database migrations, generated database types, shared contracts;
- root configuration, package scripts, dependencies, or lockfile;
- worker lease/backoff policy, gateway storage/resolution, credentials;
- background message/API routes, prompt wording/schema, transcript batching;
- Saved, Practice, Progress, authentication, or unrelated UI files.

## Interfaces

Consumes:

- accepted `youtube-overview-v2` compact block/line prompt and grounding;
- `createOpenAiCompatibleStructuredJsonClient` and
  `createOpenAiCompatibleLearningArtifactProvider`;
- existing Side Panel `triggerAnalysis`, `requestOverview`, ownership fence,
  and durable pending retry state.

Produces:

- one Overview-specific 120-second request budget without changing the generic
  30-second budget;
- an honest in-progress Overview presentation during both initial registration
  and continued pending polling.

## TDD protocol and expected RED evidence

Before implementation, add focused tests that fail because:

1. an Overview request is aborted by the current generic timeout even though it
   would complete within the larger Overview budget;
2. a translation or other non-Overview completion still aborts at the generic
   budget, proving the timeout was not globally raised;
3. starting and resuming an Overview leaves the summary as the inert placeholder
   instead of the two-minute progress message.

Use fake timers or an injected short timeout seam. Do not make the test suite
sleep for real minutes. Record exact RED command/output in the handoff, then add
the minimal implementation and record GREEN.

## Verification

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
node --test extension/tests/translation.test.js
pnpm eslint src/server/ai/openai-compatible-provider.ts tests/integration/youtube/learning-artifacts.test.ts
node --check extension/sidepanel.js
pnpm typecheck
git diff --check 31c2019b774896780ac291e41c0fcab589994313..HEAD
```

## Upstream and license

- YouTube Digest upstream: `zarazhangrui/youtube-digest`, fixed commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Continue modifying the existing
  derived `triggerAnalysis`/tab path in place; do not create a parallel client.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9, commit
  `723e259309aea5e3850265b631f80224f66dd9f6`. No GPLv3 code, tests, prompts,
  components, or assets may be copied. This task requires no LLM Wiki reuse.
- Preserve the repository's existing MIT/upstream notices. Do not add a new
  dependency or copied third-party material.

## Handoff contract

Commit only this task. Return `DONE`, commit SHA, RED and GREEN summaries,
verification results, residual risks, and the report path. The report must be
`docs/engineering/handoffs/delivery/task-5i-overview-timeout-feedback.md`.
