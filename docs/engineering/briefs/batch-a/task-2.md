# Batch A Task 2 Brief — Native Chinese transcript resolution

## Identity and baseline

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 2.
- Baseline: `f4a25dbceaffbc0562516945cbdb0323a64448f0` (Foundation freeze plus reviewed `CONTRACT-003`).
- Worktree: `/private/tmp/popcorn-batch-a-2`; branch `codex/popcorn-batch-a-2`.
- Parallel owners: Task 1 repair owns extension auth/background/options and auth web routes; Task 4 owns capture repositories/domain/routes. Do not edit their files.

## Allowed files

Create only:

- `src/server/transcript/provider.ts`
- `src/server/transcript/supadata-provider.ts`
- `src/server/transcript/normalize-transcript.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/jobs/handlers/resolve-snapshot.ts`
- `src/app/api/v1/youtube/[videoId]/transcript/route.ts`
- `src/app/api/v1/jobs/[jobId]/route.ts`
- `src/app/api/internal/jobs/process/route.ts`
- `tests/contract/transcript/supadata-provider.test.ts`
- `src/server/transcript/normalize-transcript.test.ts`
- `tests/integration/jobs/resolve-snapshot.test.ts`
- `docs/engineering/handoffs/batch-a/task-2.md`

Commit this brief unchanged. Forbidden: all extension files, capture/AI routes, shared contracts, migrations/RLS/generated types, root config/lockfile, env schema, ledger/checkpoints, dependencies, and every unlisted path.

## Frozen interfaces consumed

- `YouTubeVideoIdSchema`, canonical YouTube URL rule, `TranscriptSegmentSchema`, `VideoSnapshotSchema`, `ApiFailureSchema`, `KnowledgeJobSchema`.
- `src/server/domain/lease-job.ts`: `leaseJob`, `nextJobFailure`, five attempts, five-minute lease, deterministic retry delay/exhaustion. Do not duplicate or weaken these rules.
- Migration 004 `public.knowledge_job_internal`: service-only JSON object storage for Provider job reference/result. Provider job IDs/payload/results must never be written to public `knowledge_jobs` or returned by the public job endpoint.
- Explicit service-role grants do not replace tenant checks. Every service-role read/update/insert must include the expected `user_id`; any mismatch is a hard refusal.
- Server-only `SUPADATA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `INTERNAL_JOB_SECRET`; no credential enters URLs, logs, client responses, fixtures, or the extension.

## Interfaces produced

- `TranscriptProvider` boundary and `requestNativeChineseTranscript(videoId)` returning `{kind:'ready', snapshot}`, `{kind:'pending', providerJobId}`, or typed unsupported/retryable/terminal failure.
- Stable normalized segment shape preserving exact cleaned Chinese, ordinal, start/end seconds, language `zh-CN`, plain text and `[M:SS]` text.
- Minimal recoverable `resolve_snapshot` processor with bounded leasing and owner-filtered state transitions.
- Authenticated `GET /api/v1/youtube/[videoId]/transcript`, authenticated owner-only `GET /api/v1/jobs/[jobId]`, and secret-protected bounded `POST /api/internal/jobs/process`.
- For Provider 202, client receives only Popcorn's UUID job ID. The Provider job ID lives only in `knowledge_job_internal.input`.

## Required upstream reuse

- Source: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT.
- Adapt method and concrete behavior from `extension/background.js:handleFetchTranscript` and `pollTranscriptJob` (approximately lines 592–803): canonical URL stripping, `/v1/transcript`, `text=false`, `mode=native`, `x-api-key`, explicit 202/206/401/429 handling, `>>` caption cleanup, millisecond offset/duration conversion, plain/timestamped outputs, and async job polling semantics.
- Deliberate changes: `lang=zh` rather than `en`; Provider calls are server-only; 202 becomes durable Popcorn leasing rather than a one-worker 60-second loop; public failures use frozen Popcorn codes.
- Handoff must map each reused upstream function/block to target functions and list adaptation. Preserve `extension/UPSTREAM.md`/MIT notices; do not copy LLM Wiki GPLv3 code, tests, prompt, names, or structure. LLM Wiki contributes only the already frozen durable-job/source-traceability method.

## Strict TDD — RED first

Write the three test files before production code and capture failing output. At minimum cover:

1. Provider URL is exactly canonical YouTube with only `url`, `text=false`, `lang=zh`, `mode=native`; invalid ID fails before fetch; key is a header, never URL.
2. HTTP 200 normalization; 202 bounded Provider job reference; 206/404 no native transcript; 401 config failure; 429 retryable; 5xx/network retryable; malformed/oversized JSON; empty content.
3. Reject aggregate or chunk languages `en`, `zh-TW`, `zh-Hant`, mixed fallback, and non-Han content. Accept only native Simplified metadata (`zh`, `zh-CN`, or `zh-Hans`) and map persisted language to exact `zh-CN`. This is the Provider enforcement for `LANG-001`; do not claim exhaustive orthographic conversion.
4. Caption cleanup is exact and source text is not translated/rewritten. Offsets/durations convert deterministically. Stable IDs/hash use snapshot hash plus ordinal/start/end/exact cleaned text hash, never array index alone; same input is stable and any identity component change changes the ID.
5. HTTP 200 persists one owner/source snapshot and stable segments. HTTP 202 persists one owner-filtered `resolve_snapshot` job plus private Provider reference and returns the Popcorn job UUID only.
6. Leasing recovers an expired worker lease, refuses active leases/wrong expected user, uses frozen attempt/retry rules, terminalizes the fifth failed attempt, and sets `updated_at` deterministically. Concurrent claims may not both own one job.
7. Completed polling normalizes/persists then clears or bounds private Provider data and marks success. Public job status is authenticated owner-only, schema-valid and contains no Provider ID/input/raw payload. User B and wrong service expected-user checks fail.
8. Internal route uses exact `INTERNAL_JOB_SECRET`, constant bounded request processing and no job details on auth failure. Public routes never use service role without explicit owner match.

Run RED:

```bash
pnpm vitest run tests/contract/transcript/supadata-provider.test.ts src/server/transcript/normalize-transcript.test.ts tests/integration/jobs/resolve-snapshot.test.ts
```

Expected: fail because target modules/routes do not exist.

## Implementation boundaries

- Use dependency-injected factories in routes/processors so CI uses fixed fakes and no real Provider/network. Real Provider is deferred to Delivery manual verification.
- Do not alter contracts/migrations to fit code. Use `knowledge_job_internal` exactly as generated. JSON written there must be bounded objects validated at the boundary.
- Use unique source/job constraints and explicit owner predicates. Do not expose a generic URL/text transcript endpoint.
- A transcript request may call Supadata; a save/capture request may not. Do not couple this handler into Task 4's synchronous save path.
- No AI, translation, overview, expressions, pgvector, graph, chat, export, video download, or alternate source.

## Verification and handoff

```bash
pnpm vitest run tests/contract/transcript/supadata-provider.test.ts src/server/transcript/normalize-transcript.test.ts tests/integration/jobs/resolve-snapshot.test.ts
CI=true pnpm typecheck
CI=true pnpm test:contract
CI=true pnpm test:unit
CI=true pnpm test:provenance
pnpm lint
git diff --check
git status --short
```

Commit as `feat: resolve native Chinese transcripts durably`. Handoff must include baseline/head, RED/GREEN output summary, every changed file, upstream mapping/license action, owner/RLS/lease evidence, tests, risks, and clean status. Return commit SHA; do not self-approve.
