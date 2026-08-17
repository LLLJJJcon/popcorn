# Batch A Task 4 Brief — Idempotent cloud capture APIs

## Identity and baseline

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 4.
- Baseline: `f4a25dbceaffbc0562516945cbdb0323a64448f0` (Foundation freeze plus independently reviewed `CONTRACT-003`).
- Worktree: `/private/tmp/popcorn-batch-a-4`; branch `codex/popcorn-batch-a-4`.
- Parallel owners: Task 1 repair owns extension auth/background/options and auth web routes; Task 2 owns transcript/jobs processing and transcript/job routes. Do not edit their files.

## Allowed files

Create only:

- `src/server/repositories/video-source-repository.ts`
- `src/server/repositories/saved-item-repository.ts`
- `src/server/repositories/knowledge-job-repository.ts`
- `src/server/domain/capture-save.ts`
- `src/app/api/v1/extension/sync/route.ts`
- `src/app/api/v1/saved-items/route.ts`
- `tests/integration/capture/save-item.test.ts`
- `tests/integration/capture/sync-batch.test.ts`
- `docs/engineering/handoffs/batch-a/task-4.md`

Commit this brief unchanged. Forbidden: all extension files, transcript/jobs handlers, auth/AI routes, shared contracts, migrations/RLS/generated types, root config/lockfile, env schema, ledger/checkpoints, dependencies, and every unlisted path.

## Frozen interfaces consumed

- `SavedItemInputSchema` and its six exact variants; `ApiFailureSchema`; `Database` generated types.
- Migration 004 `public.capture_saved_item(text,uuid,text,timestamptz,numeric,jsonb)` is the only atomic persistence primitive. Do not reproduce source/save/job multi-query logic in TypeScript and do not add a second save path.
- The RPC derives owner exclusively from the authenticated database session, upserts one user/video source, stores one exact raw payload, and creates one pending `resolve_snapshot` job without Provider work.
- Authenticated user from verified Supabase access token. Public route code must verify the token and pass a user-bound client; any explicit `userId` argument must equal that verified user. Service role is not permitted for invoking capture on a caller's behalf because `auth.uid()` is authoritative.

## Interfaces produced

- Repositories whose every method requires explicit non-optional `userId`; they refuse returned rows whose owner does not match.
- `captureSave(userId, input): Promise<{videoSourceId,savedItemId,status:'saved'}>` after strict input parse and exact mapping to the frozen RPC.
- `POST /api/v1/saved-items` for one authenticated event.
- `POST /api/v1/extension/sync` for `{events: unknown[]}` with 1–50 items and one ordered per-`clientEventId` result. An invalid event is an explicit failure result while valid siblings still commit exactly once.

## Exact payload mapping

Parse `SavedItemInput` before database work. RPC common arguments are `youtubeVideoId`, `clientEventId`, `kind`, `capturedAt`, and variant-derived `startSeconds`; `payload` contains only the exact variant snapshot fields, preserving strings/arrays/order and no server-fetched enrichment:

- `video`: canonical URL/title/channel/derived thumbnail/duration/description/current time/`requestNativeSnapshot`;
- `player_moment`: `capturedSecond` and start equal to it;
- `subtitle_row`: exact segment/text/optional English/start/end/context;
- `subtitle_selection`: exact Chinese/optional English/segment IDs/times/offsets/context;
- `key_quote`: exact displayed quote/quote second/segment IDs;
- `ai_explanation`: exact selected Chinese/shown English explanation/segment IDs/times/context.

Use the variant's current/start/quote second for `p_start_seconds`; never fetch playback, subtitles, translation, or AI synchronously.

## Strict TDD — RED first

Write both tests before implementation and capture failure because modules/routes are absent. Tests must prove:

1. All six valid variants map exactly once to the RPC with no lost/added/rewritten payload fields and return only source/save IDs plus literal `saved`.
2. Invalid IDs, canonical URLs, timestamps, arrays, offsets, language direction, oversized text/batch/body fail before RPC. No generic text/URL/image/screenshot input is accepted.
3. Repository methods require explicit `userId`; verified user A cannot request/accept user B output. Missing/expired auth returns frozen bounded errors. No response exposes service keys, SQL details, job payload or Provider data.
4. Replaying one `(user,clientEventId)` returns the original IDs. A new event ID at the exact same timestamp is distinct. Same event ID under user B is isolated. Prove the code calls the one RPC rather than issuing independent table writes.
5. Capture returns before any transcript/Supadata/AI dependency is called; ideally the domain has no such dependency/import and a forbidden-call fake remains zero.
6. Batch limit is exactly 50; result order and every parseable `clientEventId` are preserved. One invalid event does not roll back or hide valid siblings. Retry of a partially acknowledged batch reuses IDs for successful events and reports every event again.
7. RPC/transport failures map to frozen error codes with correct retryability. Do not turn unknown failures into success or silently drop an event.

Run RED:

```bash
pnpm vitest run tests/integration/capture/save-item.test.ts tests/integration/capture/sync-batch.test.ts
```

## Implementation boundaries

- Use dependency-injected route/domain factories and fixed fakes in CI. Tests may rely on the controller pgTAP 237/237 proof for the SQL internals but must exercise the real TypeScript input→RPC→response mapping.
- Repositories may wrap the one RPC and owner-checked reads only. They must not query/insert source/save/job independently. If three planned repository filenames share the same RPC client, keep their roles narrow rather than inventing duplicate persistence.
- No Provider, transcript polling, AI, translation, cache, queue storage, export, vector, graph, chat, video file, generic source, or UI work.
- No upstream persistence primitive applies. This task is implemented from frozen Popcorn contracts. YouTube Digest contributes no code here. LLM Wiki contributes only the already approved idempotent/source-traceability method; copy no GPLv3 code/test/SQL/prompt/structure/asset.

## Verification and handoff

```bash
pnpm vitest run tests/integration/capture/save-item.test.ts tests/integration/capture/sync-batch.test.ts
pnpm exec supabase test db
CI=true pnpm typecheck
CI=true pnpm test:contract
CI=true pnpm test:unit
CI=true pnpm test:provenance
pnpm lint
git diff --check
git status --short
```

Commit as `feat: capture exact saved moments atomically`. Handoff must include baseline/head, RED/GREEN, mapping table, owner/auth/RPC proof, changed files, license statement, tests, risks, and clean status. Return commit SHA; do not self-approve.
