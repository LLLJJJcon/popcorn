# Task 2 Report — Saved Workspace and Learning Bridge

## Status

Implemented the Saved learning workspace on branch `codex/popcorn-youtube-learning`, constrained to the Task 2 allowlist.

## Implementation

- Added `SavedLibrary`, a client-side view over the already-loaded `SavedVideoSummary[]` with All, Ready to learn, and Processing filters shown only for mixed ready/processing data.
- Reworked Saved cards into responsive paper surfaces exposing the persisted thumbnail, title link, channel, saved count, deterministic UTC latest-activity date, and processing state.
- Added `SavedVideoDetailView` and moved page composition out of the route. The view keeps each raw Chinese moment and stored English translation ahead of generated material, nests candidate expressions under their source save, links to the canonical YouTube URL, and renders only a valid persisted current-version overview/chapters artifact.
- Changed candidate activation copy to `Practice this expression` without any Vault implication.
- Changed missing-analysis recovery to the existing per-item endpoint with user-visible states `Retry analysis`, `Starting analysis…`, `Set up model gateway`, and a generic safe retry error. Malformed published immutable artifacts still fail closed and do not expose recovery.
- Added the latest saved-item ID as a temporary local ordering key after latest activity, then explicitly projected the final `SavedVideoSummary` fields so no raw saved-item ID enters the page DTO.

## RED evidence

Command:

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx
```

Key output:

```text
Test Files  3 failed | 2 passed (5)
Tests       5 failed | 16 passed (21)
Failed to resolve import "@/features/saved/saved-library"
Failed to resolve import "@/features/saved/saved-video-detail"
Unable to find ... "Practice this expression"
Unable to find ... "Retry analysis"
```

The brief's literal example source names happen to sort the same way under the old source-ID fallback, so an additional inverse source-ID fixture was added to prove the saved-item tie-break independently.

Command:

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts
```

Key output:

```text
Test Files  1 failed (1)
Tests       1 failed | 6 passed (7)
expected [ 'source-a', 'source-z' ] to deeply equal [ 'source-z', 'source-a' ]
```

## GREEN evidence

Command:

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx tests/integration/knowledge/source-traceability.test.ts
```

Key output:

```text
Test Files  6 passed (6)
Tests       46 passed (46)
```

Command:

```bash
pnpm typecheck
```

Key output:

```text
$ tsc --noEmit
exit 0
```

Additional self-review command:

```bash
pnpm eslint 'src/app/(app)/saved/page.tsx' 'src/app/(app)/saved/[videoSourceId]/page.tsx' src/features/saved/api.ts src/features/saved/video-card.tsx src/features/saved/saved-timeline.tsx src/features/saved/candidate-list.tsx src/features/saved/candidate-expression.tsx src/features/saved/saved-library.tsx src/features/saved/saved-video-detail.tsx src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx tests/integration/saved/video-library.test.ts
```

Key output: exit 0 with no warnings or errors.

## Changed files

- `src/app/(app)/saved/page.tsx`
- `src/app/(app)/saved/[videoSourceId]/page.tsx`
- `src/features/saved/api.ts`
- `src/features/saved/video-card.tsx`
- `src/features/saved/saved-timeline.tsx`
- `src/features/saved/candidate-list.tsx`
- `src/features/saved/candidate-expression.tsx`
- `src/features/saved/candidate-list.test.tsx`
- `src/features/saved/saved-library.tsx`
- `src/features/saved/saved-library.test.tsx`
- `src/features/saved/saved-video-detail.tsx`
- `src/features/saved/saved-video-detail.test.tsx`
- `src/features/saved/saved-workspace.module.css`
- `tests/integration/saved/video-library.test.ts`
- `.superpowers/sdd/2026-09-05-popcorn-unified-learning-workspace/task-2-report.md`

## Self-review

- Confirmed raw Chinese and stored English survive terminal failures and remain visible before overview content.
- Confirmed missing analysis exposes one per-item recovery action, while malformed already-published analysis remains unavailable and cannot be retried or activated.
- Confirmed candidate activation still posts only the frozen saved-item, artifact, and candidate identifiers to the existing Practice task endpoint.
- Confirmed overview rendering consumes only already-persisted current-version content and performs no transcript fetch or reconstruction.
- Confirmed the temporary ordering key is explicitly omitted from the returned summary DTO.
- Confirmed route files remain Server Components responsible for authentication/data loading; only the library filter is a new client boundary.
- Confirmed `git diff --check` passes and pre-existing forbidden-path worktree changes were not staged or modified by this task.

## Risks

- Persisted overview content with an obsolete or malformed prompt version is intentionally hidden rather than rendered loosely; raw saves remain available. This follows the fail-closed immutable-artifact policy but means legacy overview data may not appear.
- After a recovery request is accepted, the item stays in `Starting analysis…` until a subsequent navigation or reload supplies a published artifact; no polling or new bulk job control was introduced.
