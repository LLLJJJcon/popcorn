# Task Handoff

- Status: DONE
- Plan and task: `2026-08-16-popcorn-batch-a-platform-capabilities.md`, Batch A Task 4
- Worktree and branch: `/private/tmp/popcorn-batch-a-4`, `codex/popcorn-batch-a-4`
- Baseline SHA: `f4a25dbceaffbc0562516945cbdb0323a64448f0`
- Commit SHA: returned to the controller after committing this report

## Implemented

- Added an authenticated, user-bound Supabase capture client that uses the public anon key and caller bearer token, verifies the user with `auth.getUser`, and never uses the service role.
- Added narrow repositories with an explicit non-optional `userId` on every capture/result method. The repository permits only one `capture_saved_item` RPC call and rejects a client whose verified owner differs from the requested user.
- Added strict six-variant `SavedItemInputSchema` parsing and exact input-to-RPC mapping.
- Added one-save and 1–50 event sync route handlers with bounded streaming JSON reads, no-store responses, stable ordered per-event results, and partial success.
- Added frozen bounded error mapping for authentication, validation, owner scope, idempotency conflict, and retryable transport/RPC failures without exposing SQL, job, service-key, or Provider details.

## Exact mapping to `capture_saved_item`

| Kind | `p_start_seconds` | Exact `p_payload` fields |
|---|---:|---|
| `video` | `currentTimeSeconds` | `canonicalUrl`, `title`, `channel`, `thumbnailUrl`, `durationSeconds`, `description`, `currentTimeSeconds`, `requestNativeSnapshot` |
| `player_moment` | `capturedSecond` | `capturedSecond` |
| `subtitle_row` | `startSeconds` | `segmentId`, `originalChinese`, optional `englishTranslation`, `startSeconds`, `endSeconds`, `contextBefore`, `contextAfter` |
| `subtitle_selection` | `startSeconds` | `originalChinese`, optional `englishTranslation`, `segmentIds`, `startSeconds`, `endSeconds`, `startOffset`, `endOffset`, `contextBefore`, `contextAfter` |
| `key_quote` | `quoteSeconds` | `exactQuote`, `quoteSeconds`, `segmentIds` |
| `ai_explanation` | `startSeconds` | `selectedChinese`, `englishExplanation`, `segmentIds`, `startSeconds`, `endSeconds`, `contextBefore`, `contextAfter` |

Common RPC arguments are the parsed `youtubeVideoId`, `clientEventId`, `kind`, and `capturedAt`. No common field is duplicated into `p_payload`, and no field is fetched or enriched during capture.

## Upstream provenance used

- YouTube Digest: no persistence primitive applies to this task; no upstream code or test was copied.
- LLM Wiki `v0.6.9` at `723e259309aea5e3850265b631f80224f66dd9f6`: previously approved idempotency/source-traceability method only. No GPLv3 code, SQL, test, prompt, component, structure, or asset was copied.

## Interfaces consumed and produced

- Consumed the frozen six-kind `SavedItemInputSchema`, API error taxonomy, generated `Database` RPC type, and migration 004 `capture_saved_item` contract.
- Produced `createCaptureSave`, owner-bound capture repositories, `POST /api/v1/saved-items`, and `POST /api/v1/extension/sync`.
- The TypeScript path performs no source/save/job table insert or update. Atomic source upsert, exact raw save, idempotency, and pending `resolve_snapshot` creation remain exclusively inside the frozen RPC.

## Files changed

- `src/server/repositories/video-source-repository.ts`
- `src/server/repositories/saved-item-repository.ts`
- `src/server/repositories/knowledge-job-repository.ts`
- `src/server/domain/capture-save.ts`
- `src/app/api/v1/extension/sync/route.ts`
- `src/app/api/v1/saved-items/route.ts`
- `tests/integration/capture/save-item.test.ts`
- `tests/integration/capture/sync-batch.test.ts`
- `docs/engineering/briefs/batch-a/task-4.md` (controller brief committed unchanged)
- `docs/engineering/handoffs/batch-a/task-4.md`

## TDD evidence

### RED

The first non-CI invocation was stopped before Vitest by pnpm's non-interactive modules-directory guard. Re-running the required command with the repository's CI mode produced the genuine missing-implementation RED:

```text
$ CI=true pnpm vitest run tests/integration/capture/save-item.test.ts tests/integration/capture/sync-batch.test.ts
exit 1
Test Files 2 failed (2)
Tests no tests
Failed to resolve import "@/server/domain/capture-save"
```

After the initial minimum implementation, focused tests exposed two boundary defects before GREEN: 4/8 failed because route-level fakes bypassed shared parsing and owner-scope errors were categorized as retryable. Adding route parsing and a `FORBIDDEN` scope mapping resolved them.

The first complete `pnpm verify` then caught an App Router export violation not visible to plain `tsc`: route files exported test factories. The factories were moved into the Task 4 domain module, leaving route modules with `POST` as their only export; the subsequent production build passed.

### GREEN

```text
$ CI=true pnpm vitest run tests/integration/capture/save-item.test.ts tests/integration/capture/sync-batch.test.ts
exit 0; Test Files 2 passed (2); Tests 8 passed (8)

$ CI=true pnpm typecheck
exit 0

$ CI=true pnpm build
exit 0; both API routes compiled as dynamic server routes
```

The focused tests prove all six exact maps, pre-RPC rejection, one-RPC scope enforcement, stable replay identities, no Provider call, frozen auth/error responses, exact batch bounds, ordered mixed results, and partial retry behavior.

## Broader verification

```text
node_modules/.bin/supabase test db
  PASS; Files=1, Tests=237

CI=true pnpm test:contract
  PASS; 128/128

CI=true pnpm test:unit
  PASS; 76/76

CI=true pnpm test:provenance
  PASS; 11/11

CI=true pnpm lint
  PASS; zero warnings

CI=true pnpm verify
  first run exposed and drove the route-export correction; final fresh result is recorded before commit
```

`git diff --check` and exact scope/status checks are run immediately before commit.

## Contract or migration changes requested

None. No frozen contract, migration, generated type, root configuration, lockfile, extension, transcript/job handler, ledger, or checkpoint changed.

## Risks and follow-up

- SQL atomicity, cross-user identity, one-parent behavior, and job coalescing are delegated intentionally to the frozen RPC and remain covered by the independently reviewed 237-test pgTAP suite.
- Batch processing is sequential and bounded at 50. A worker/request interruption may leave a prefix committed; retrying the same client event IDs returns the original logical rows by the RPC contract.
- Provider and transcript work remain wholly outside capture. Batch A Tasks 2/3 process the durable job later, and Task 6 owns the extension's local queue and acknowledgement removal.
