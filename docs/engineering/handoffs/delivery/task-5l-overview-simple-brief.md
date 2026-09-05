# Delivery recovery Task 5L brief — Simple resilient Overview

## Identity

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-delivery-demo.md`
- Task: Delivery Task 5 live-smoke recovery subtask 5L
- User-approved design: 2026-09-05 chat decision to make Overview useful-first instead of all-or-nothing
- Baseline commit: `0cdd7f9d94c799cc093fc54ed2634d52d5d275d0`
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn-overview-simple`
- Branch: `codex/popcorn-overview-simple`
- Report: `docs/engineering/handoffs/delivery/task-5l-overview-simple-report.md`

## Product outcome

Overview is one background model call over the complete persisted Chinese transcript. A usable summary must render even when the model does not return perfect JSON. Chapters and Key Quotes are optional enhancements: reject/drop an invalid item without rejecting the summary or the other valid items. A failed Overview job must stop after one Provider call; a user may explicitly choose Retry, which creates one new durable job. A successful artifact remains deduplicated and reusable for the same transcript, prompt version, and gateway fingerprint.

## Required behavior

1. Change the Overview prompt version to exactly `youtube-overview-v4-simple` so old v1–v3 terminal jobs cannot mask this behavior.
2. Send the complete persisted transcript in chronological order exactly once in one request and make exactly one Provider call per job. Keep the existing lossless `sourceLineIndex + JSON string literal` line representation; do not chunk or make parallel/multi-round calls.
3. Ask for a concise English overview, optional 1–8 chapters, and optional 0–5 key quotes. JSON is preferred, but plain prose is valid.
4. Provider response handling for Overview only:
   - Read the assistant message as bounded text. Preserve strict JSON-only parsing for translation and explanation.
   - Accept a non-empty plain-text response (including a single enclosing Markdown code fence) as `overview`, with empty `chapters` and `keyQuotes`.
   - If the text parses as a JSON object with a non-empty string `overview`, use that summary. Ignore unknown fields.
   - Parse chapter candidates independently. Keep only candidates with non-empty string `title` and `summary` and an integer `sourceLineIndex` that names an existing transcript segment. Map the accepted item to that segment's real timestamp and stable ID. Cap accepted chapters at 8.
   - Parse quote candidates independently. Require non-empty string `quote` and `englishMeaning`. Prefer a supplied valid `sourceLineIndex` only when that exact Chinese quote is a substring of that line; otherwise search the persisted transcript in chronological order and anchor the first exact match. Drop an ungrounded quote. Cap accepted quotes at 5.
   - If JSON is parseable but has no usable non-empty `overview`, fail with the existing bounded `PROVIDER_OUTPUT_INVALID` category. Do not expose raw Provider text in API errors or logs.
   - Keep existing request/response byte limits. Set Overview `max_tokens` to 900. Keep the 120-second Overview timeout; translation/explanation timeouts and payloads must not change.
5. Relax only the persisted/public Overview schema so `chapters` and `keyQuotes` may be empty. Keep all existing bounds and grounding validation for items that are present. Do not weaken owner/source/gateway validation.
6. Overview job failure is terminal after its first leased attempt, regardless of whether the bounded category is unavailable or output-invalid. Do not change the five-attempt policy for any other job type. The existing explicit Retry button remains the only way to request another Provider call.
7. Extension presentation:
   - On successful summary-only content, display the overview and hide the complete Chapters and Key Quotes sections instead of leaving placeholders.
   - Show a non-empty optional section when it has accepted items.
   - While pending, the existing progress presentation may show both optional sections.
   - On failure, show the existing safe error and Retry in the Overview section, hide both optional sections, and do not leak Provider details.
8. Preserve durable Side Panel resume, stale-video ownership fences, authentication, gateway pinning, cached successful artifact reuse, and background-only Provider execution.

## Allowed files

- `src/server/ai/prompts/youtube-overview.v1.ts`
- `src/server/ai/openai-compatible-provider.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `extension/sidepanel.js`
- `extension/sidepanel.html`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/delivery/task-5l-overview-simple-report.md`

## Forbidden files

- All database migrations, generated database types, shared source/auth/queue contracts, root configuration, `package.json`, lockfiles, environment files, gateway settings UI, Saved/Practice/Progress features, background routes, and vendor code.
- Do not modify `extension/background.js`; its authenticated terminal signal and route allowlist are frozen.
- Do not read, print, copy, or commit API keys or other secrets.

## Consumed interfaces

- `LearningArtifactEvidence` ordered persisted segments.
- Existing OpenAI-compatible `/chat/completions` envelope.
- Existing `OverviewContentSchema`, `validateOverviewContent`, job transition store, artifact completion, dedupe registration, and Side Panel `sendCloudAction`/resume flow.

## Produced interfaces

- Prompt version `youtube-overview-v4-simple`.
- Backward-compatible Overview content shape `{ overview, chapters, keyQuotes }`, now permitting empty optional arrays.
- Existing API response envelope and terminal boolean; no new public fields.

## Mandatory RED evidence

Before production edits, add behavior tests and run them against the baseline to prove failure for at least:

- plain prose becoming a summary-only artifact;
- partial JSON retaining its summary and only valid grounded optional items;
- a quote with a wrong/missing line index recovering by exact local transcript match;
- empty optional arrays passing public artifact validation while malformed present items still fail;
- first Overview Provider failure becoming terminal while translation/explanation retain automatic retry behavior;
- summary-only rendering hiding both optional sections, and failure rendering hiding them while keeping Retry;
- successful same-video/same-snapshot reuse performing no new Provider call (use the existing route/dedupe boundary rather than a source-text assertion).

Record the exact failing commands and expected assertion failures in the report before writing production code.

## Verification commands

- `pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts`
- `node --test extension/tests/translation.test.js`
- `pnpm eslint src/server/ai/prompts/youtube-overview.v1.ts src/server/ai/openai-compatible-provider.ts src/server/jobs/handlers/generate-overview.ts tests/integration/youtube/learning-artifacts.test.ts`
- `pnpm typecheck`
- `node --check extension/sidepanel.js`
- `git diff --check 0cdd7f9d94c799cc093fc54ed2634d52d5d275d0..HEAD`

## Upstream reuse and license boundary

- YouTube Digest upstream: `zarazhangrui/youtube-digest` commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Reuse the already-integrated Side Panel rendering/cache/seek mechanisms in this repository; do not create a parallel analysis UI or re-copy upstream files.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9, commit `723e259309aea5e3850265b631f80224f66dd9f6`. Method inspiration only. Do not copy GPLv3 code, tests, prompts, components, or assets.
- No new dependency or license change is permitted.

## Handoff contract

Implement only this subtask using strict RED → GREEN → refactor. Do not create sub-agents. Commit the implementation and report. Return only: `DONE`/`DONE_WITH_CONCERNS`/`NEEDS_CONTEXT`/`BLOCKED`, commit SHA, one-line RED evidence, one-line GREEN evidence, risks, and report path.
