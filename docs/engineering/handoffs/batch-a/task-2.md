# Batch A Task 2 Handoff — Native Chinese transcript resolution

## Identity

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 2.
- Recorded task baseline: `f4a25dbceaffbc0562516945cbdb0323a64448f0`.
- Controller-owned prerequisite integrated before implementation: `21ee0e15ac3cd856b4ebfd1ffd62dd539b2fb53f` (`CONTRACT-004`, atomic `claim_knowledge_jobs` RPC).
- Effective implementation parent: `21ee0e15ac3cd856b4ebfd1ffd62dd539b2fb53f`.
- Task HEAD: the `feat: resolve native Chinese transcripts durably` commit containing this handoff; its immutable SHA is returned to the controller with this report.
- Worktree: `/private/tmp/popcorn-batch-a-2`.

## Delivered scope

- Server-only Supadata boundary for canonical YouTube video IDs, native Simplified Chinese transcript requests, one-step async polling, bounded payloads, and typed Provider failures.
- Deterministic native transcript normalization with exact caption cleanup, millisecond conversion, stable segment IDs, transcript hash, plain text, and timestamped text.
- Durable `resolve_snapshot` processing using the controller-owned atomic claim RPC, frozen lease/retry/attempt rules, lease fencing, bounded concurrent processing, and owner-filtered persistence.
- Authenticated transcript and owner-only job-status APIs plus a secret-protected bounded internal processor API.
- Frozen `createJobResultKey` use with explicit inputs: canonical YouTube URL SHA-256 as `sourceHash`, `savedItemHash: null`, prompt version `native-transcript-resolution-v1`, and model version `supadata-native-v1`.
- Successful asynchronous jobs retain only bounded private result `{snapshotId}` while clearing Provider input. Public status parses that strict result and never returns Provider IDs, private input, or raw payload. Public responses use `Cache-Control: no-store`.

## Changed files

- `docs/engineering/briefs/batch-a/task-2.md` (controller brief, committed unchanged)
- `docs/engineering/handoffs/batch-a/task-2.md`
- `src/server/transcript/provider.ts`
- `src/server/transcript/supadata-provider.ts`
- `src/server/transcript/normalize-transcript.ts`
- `src/server/transcript/normalize-transcript.test.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/jobs/handlers/resolve-snapshot.ts`
- `src/app/api/v1/youtube/[videoId]/transcript/route.ts`
- `src/app/api/v1/jobs/[jobId]/route.ts`
- `src/app/api/internal/jobs/process/route.ts`
- `tests/contract/transcript/supadata-provider.test.ts`
- `tests/integration/jobs/resolve-snapshot.test.ts`

No shared contract, migration, generated type, extension, root configuration, dependency, lockfile, ledger, or checkpoint file was changed by this task.

## TDD evidence

- Initial RED: the three required test files failed because the transcript/provider/job modules did not exist.
- Lease-fencing RED: 3 of 7 integration tests failed until expected lease owner and expiry were included in state transitions.
- Capture-start RED: 1 of 8 integration tests failed until a claimed job without private Provider input initiated one durable Provider request.
- Timeout/concurrency RED: two tests failed until Provider fetches used a four-second abort signal and claimed jobs ran concurrently within the fixed bound.
- Production-build RED: Next.js 16 rejected route modules that exported test factories. Factories moved to server modules; route modules now export only `GET` or `POST`.
- Result-key/public-result RED: 5 of 10 integration tests failed before frozen result-key use, retained bounded success result, private-input clearing, and `no-store` were implemented.
- Final focused GREEN: 3 files, 36 tests passed.

## Ownership, queue, and privacy evidence

- The sole cross-tenant operation is `claim_knowledge_jobs(p_limit, p_now)`. It atomically returns leased rows with their database-owned `user_id`.
- Every subsequent service-role read, insert, update, and upsert either includes `user_id: expectedUserId` in its row or filters by `.eq("user_id", expectedUserId)`; returned ownership is checked before use.
- Job state updates additionally fence on job ID, `status = leased`, and the claimed `lease_expires_at`.
- Provider job IDs are validated as a single bounded private field and stored only in `knowledge_job_internal.input`.
- A completed result writes strict `{snapshotId}` to `knowledge_job_internal.result` before the fenced success transition. Provider input is retained if the fence is lost, then cleared only after a successful transition, so another worker can recover.
- Public success results are strict-parsed, reject extra Provider/payload fields, and are read by both expected user ID and job ID. User B receives not found.
- Claim size is capped at 10, claimed work is concurrent within that bound, Provider calls time out after four seconds, and each poll invocation performs one Provider request only.
- Retry/exhaustion delegates to the frozen `nextJobFailure`; the fifth failed attempt terminalizes and terminal/private cleanup is deterministic.

## Upstream reuse and licenses

Source: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7` (MIT).

- `extension/background.js:handleFetchTranscript` request behavior maps to `createSupadataTranscriptProvider`: canonical watch URL; `/v1/transcript`; only `url`, `text=false`, `lang=zh`, and `mode=native`; `x-api-key`; explicit 200/202/206/401/429/5xx behavior.
- Its chunk cleanup, millisecond offsets/durations, and plain/timestamped renderings map to `normalizeNativeChineseTranscript`. The adaptation validates returned native language/content and persists exact `zh-CN` evidence rather than requesting English.
- `extension/background.js:pollTranscriptJob` one-step status semantics map to `TranscriptProvider.poll` and `createResolveSnapshotHandler`. The upstream one-worker polling loop was deliberately replaced by one bounded Provider call per durable leased invocation.
- Provider credentials and calls moved server-side; public errors use Popcorn's frozen codes.
- Existing `extension/UPSTREAM.md` provenance and `third_party/youtube-digest/LICENSE` MIT attribution remain unchanged.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6` contributed only the already frozen durable-job/source-traceability method. No GPLv3 code, tests, prompts, components, assets, names, or structure were copied.

## Fresh verification

- Required focused Vitest: 3 files, 36 tests passed.
- `CI=true pnpm typecheck`: passed.
- `CI=true pnpm test:contract`: 2 files, 144 tests passed.
- `CI=true pnpm test:unit`: 7 files, 84 tests passed.
- `CI=true pnpm test:provenance`: 2 files, 11 tests passed.
- `CI=true pnpm lint`: passed.
- `CI=true pnpm build`: passed; all three dynamic API routes compiled and Next route export validation passed.
- `git diff --check`: passed.

## Risks and deferred validation

- CI uses fixed Provider fixtures by design. A real Supadata request and asynchronous poll remain Delivery manual-verification work and require external credentials.
- A worker that loses its lease after writing a bounded private result can leave that result unexposed while the job is non-succeeded; the Provider input is intentionally retained so the winning worker can recover and overwrite the bounded result.
- Snapshot metadata uses the latest owner-filtered video save when available and a deterministic YouTube fallback otherwise; richer metadata is owned by the capture/integration tasks.
- This handoff reports implementation evidence only. Independent review and controller integration are still required.
