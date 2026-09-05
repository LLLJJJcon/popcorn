# Delivery recovery Task 5N — Supadata transcript timeout clarity

- Plan/task: repair of Batch A Task 2 (`2026-08-16-popcorn-batch-a-platform-capabilities.md`) during revised Delivery Task 5 live smoke.
- Baseline commit: `fb45a2d7da8e5d893b9436319d4fd3a363cb950c`.
- Worktree: `/private/tmp/popcorn-transcript-timeout-30`.
- Allowed implementation file: `src/server/transcript/supadata-provider.ts`.
- Allowed report file: `docs/engineering/handoffs/delivery/task-5n-transcript-timeout-report.md`.
- Forbidden: migrations, shared contracts, root configuration, lockfiles, extension files, model-gateway code, AI transcription, new providers, prompt/UI redesign, or files outside the allowlist.
- Consumes: the frozen Supadata native transcript request contract (`mode=native`, preferred `lang=zh`) and existing `TranscriptProvider` result types.
- Produces: a 30,000 ms default timeout for Supadata transcript request and polling. Existing HTTP `206` handling must remain an immediate, non-retryable `NATIVE_CHINESE_TRANSCRIPT_REQUIRED` result so the current extension presentation says no native Chinese transcript is available.
- Live diagnosis: video `RPhGQDfVUl0` reached Supadata after the configured local proxy. Popcorn timed out at 4.0 seconds; the same bounded diagnostic request returned HTTP 206 at 6.896 seconds. Invalid API credentials would return HTTP 401, not this accepted 206 response.
- Retry requirement: do not change retry rules broadly. HTTP 206 must not enter the durable retry loop; existing retryable network/provider failures remain unchanged.
- Product boundary: do not add AI audio transcription. Videos without a native Chinese transcript remain unsupported.
- Testing exception: the user explicitly requested on 2026-09-05 that this repair be completed without adding or running tests. Do not modify test files and do not claim test evidence. Perform only diff/static self-review necessary to ensure the exact one-file change.
- Verification: inspect the baseline-to-HEAD diff and confirm the default value is exactly `30_000`, all existing 206 branches remain unchanged, and no other file besides the allowed implementation/report files changed. Do not run test commands.
- Upstream reuse: the surrounding acquisition/polling flow remains the pinned YouTube Digest adaptation from `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not create a parallel transcript path.
- License: retain YouTube Digest MIT provenance; do not copy any `nashsu/llm_wiki` GPLv3 code, tests, prompts, components, or assets.
- Handoff: commit implementation and report, then return commit SHA, changed files, static verification result, risks, and report path.
