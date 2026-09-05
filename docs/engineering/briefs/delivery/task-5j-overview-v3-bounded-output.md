# Delivery Task 5J — Overview v3 bounded single-text request

## Identity

- Plan: revised local-first Delivery live-smoke recovery.
- Task: 5J — Overview v3 bounded single-text request.
- Baseline commit: `ca73c4b89974cce5e3e9f56ed3333da3311e183a`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn-overview-v3`.
- Branch: `codex/popcorn-overview-v3`.

## Confirmed evidence

The real 815-row transcript contains 8,190 Chinese characters / 22,794 UTF-8
bytes. The accepted v2 block/line prompt is approximately 33.8 KB. The active
gateway and credential completed five translation jobs on the first attempt,
and proxy connectivity completed in under one second. The same gateway timed
out on every full Overview attempt: first at 30 seconds and then at the new
120-second Overview-only budget. The request remained leased until the timeout,
so this is not the old byte-cap rejection or an expired credential.

## Required behavior

1. Version Overview as exactly `youtube-overview-v3`, so no v1/v2 terminal or
   retry job can be reused.
2. Send the complete persisted Chinese transcript exactly once in one compact
   user prompt and make exactly one Provider completion call. No sampling,
   omission, pre-summary, truncation, parallel request, or multi-round call.
3. Replace v2 block plus per-line time ranges with one chronological global
   line index per persisted segment and its complete original Chinese text.
   Do not send stable IDs, user IDs, snapshot IDs, gateway metadata, or per-line
   timestamps to the Provider.
4. The strict gateway response returns `sourceLineIndex` for every chapter and
   key quote. It does not return a timestamp or block index. Map the index to
   exactly one real persisted segment, set the public `timestampSeconds` from
   that segment's `startSeconds`, attach only that segment's stable ID, and run
   the unchanged public `validateOverviewContent` grounding gate. Unknown or
   out-of-range lines fail closed as `PROVIDER_OUTPUT_INVALID`.
5. Ask for a concise whole-video result: 1–8 chapters appropriate to the
   material and exactly 3–5 key quotes. A key quote must be an exact Chinese
   substring of its anchored line. Keep all existing public field limits.
6. Bound only the Overview completion output with the standard
   OpenAI-compatible request field `max_tokens: 1800`. Translation and
   explanation request bodies remain unchanged. Keep the Overview timeout at
   120,000 ms, generic timeout at 30,000 ms, request cap at 65,536 bytes, and
   response cap unchanged.
7. Preserve fixture-first CI, gateway resolution, durable queue behavior,
   retry identity, and save-path Provider independence.

## File ownership

Allowed:

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/prompts/youtube-overview.v1.ts` (may remain at this historical
  path or be replaced by a v3 file if every import is updated in scope)
- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/delivery/task-5j-overview-v3-bounded-output.md`

Forbidden:

- extension, background, API route, database, migrations, generated types;
- root config, dependencies, lockfile, worker/backoff, gateway storage/key;
- translation/explanation prompt semantics or unrelated application files.

## Interfaces

Consumes the accepted Task 5G/5I provider client, one-call Overview adapter,
120-second Overview timeout, `LearningArtifactEvidence.segments` persisted
order, and unchanged public Overview validator.

Produces a v3 semantic key through the existing prompt-version interface, one
compact global-line prompt, bounded Overview output, and exact internal
line-to-segment grounding.

## Required RED/GREEN tests

Before implementation, add tests that fail against v2 and prove:

1. all 815 complete Chinese rows occur exactly once and in order in one prompt;
   first and last are retained; no stable/user/snapshot IDs or timestamps leak;
2. the request is below 65,536 bytes, `fetch` is called once, and its JSON body
   includes exactly `max_tokens: 1800` for Overview;
3. translation request JSON has no `max_tokens` addition;
4. a valid global source line maps to exactly its real stable ID and persisted
   start time; out-of-range line, mismatched quote, or fabricated evidence fails;
5. the exported prompt version is exactly `youtube-overview-v3`.

Record the real RED command/output, implement minimally, then record GREEN.

## Verification

```text
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
pnpm eslint src/server/ai/openai-compatible-provider.ts src/server/ai/prompts/youtube-overview.v1.ts tests/integration/youtube/learning-artifacts.test.ts
pnpm typecheck
git diff --check ca73c4b89974cce5e3e9f56ed3333da3311e183a..HEAD
```

## Upstream and license

- YouTube Digest: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. This server-only task does not
  replace or duplicate its extension flow.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`. Reuse no GPLv3 code, tests,
  prompts, components, or assets.
- Add no dependency or third-party code; preserve existing notices.

## Handoff

Commit only this task and write the report to
`docs/engineering/handoffs/delivery/task-5j-overview-v3-bounded-output.md`.
Return status, commit SHA, RED/GREEN evidence, verification, and risks.
