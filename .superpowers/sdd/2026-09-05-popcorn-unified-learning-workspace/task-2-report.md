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

## Review repair round 1

### Findings verified

1. The recovery client rejected the candidate endpoint's existing legal `ready` response because its discriminated union covered only `gateway_required` and `processing`.
2. The Server Component passed unvalidated immutable artifact `content` into the `CandidateList` Client Component, so hidden malformed fields could still cross the React server/client serialization boundary.
3. Saved detail ownership validation treated an unresolved same-owner/same-source `savedItemId` reference as a page-level ownership failure, hiding otherwise valid raw saves.

### Repair RED

After updating the existing overview fixture from the subsequently superseded `youtube-overview-v1` pin to the current `youtube-overview-v2` pin, the three repair regressions failed for only the intended reasons:

```bash
pnpm vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-video-detail.test.tsx tests/integration/saved/video-library.test.ts
```

```text
Test Files  3 failed (3)
Tests       3 failed | 20 passed (23)
expected router.refresh to be called once, received 0
expected CandidateList props to contain analysis: unavailable; received raw artifact content including providerBody
same-source orphaned artifact caused Saved detail to be null
```

### Repair implementation

- Added the endpoint's complete strict `ready` response to the recovery schema and refresh the current Server Component tree once when it is returned.
- Replaced the raw client artifact prop with a discriminated `CandidateAnalysis` value. `SavedVideoDetailView` now validates prompt version and candidate schema on the server, passing only parsed candidates for `ready`, or content-free `missing` / `unavailable` markers.
- Kept artifact user/source checks in the page-level ownership gate. A saved-item reference that resolves to a returned item must still match its source; an unknown same-source reference is quarantined from the artifact DTO instead of removing the raw page.
- Corrected the previous integration test that expected an orphaned same-source artifact to null the whole page, and added explicit artifact-level cross-owner and cross-source fail-closed cases.

### Repair GREEN

Per-finding checks:

```text
ready recovery: 1 passed
server/client artifact boundary: 1 passed
artifact quarantine plus ownership isolation: 9 passed
combined repair regressions: 21 passed
```

Original Task 2 focused suite:

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx tests/integration/knowledge/source-traceability.test.ts
```

```text
Test Files  6 passed (6)
Tests       48 passed (48)
```

```bash
pnpm typecheck
```

```text
$ tsc --noEmit
exit 0
```

The scoped Task 2 ESLint command also exited 0 with no warnings or errors.

### Repair files

- `src/features/saved/api.ts`
- `src/features/saved/candidate-list.tsx`
- `src/features/saved/candidate-list.test.tsx`
- `src/features/saved/saved-video-detail.tsx`
- `src/features/saved/saved-video-detail.test.tsx`
- `tests/integration/saved/video-library.test.ts`
- `.superpowers/sdd/2026-09-05-popcorn-unified-learning-workspace/task-2-report.md`

### Repair self-review and risks

- Cross-owner and cross-source artifact rows still return null for the entire detail; tests cover both independently.
- Orphaned same-source artifact content is discarded before `SavedArtifactView` construction, so arbitrary fields cannot reach `SavedVideoDetailView`.
- A matching immutable artifact is parsed in the Server Component and only schema-approved candidates cross into `CandidateList`; malformed and obsolete artifacts carry no raw content across that boundary.
- The `ready` recovery path depends on Next.js `router.refresh()` to re-read the published artifact. It does not duplicate endpoint candidates into local state, preserving the server as the source of truth.
