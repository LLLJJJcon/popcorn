# Batch B Task 2 handoff

## Scope

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 2.
- Controller baseline: `3254fc96b5d1f4d48c5f8c5a4b646ee28476ba04`.
- Note: the committed brief names `bc02122` as the functional Batch A baseline, while the assigned worktree starts at `3254fc9`, the later brief commit. No shared file was changed to reconcile that documentation-only difference.
- Worktree: `/private/tmp/popcorn-batch-b-2`.
- License: no YouTube Digest UI and no LLM Wiki GPLv3 code, tests, prompts, components, assets, or links were copied. This implementation consumes Popcorn's persisted rows only.

## RED evidence

Command (using the pinned local Vitest binary because `pnpm exec` attempted an unavailable registry metadata fetch):

```bash
./node_modules/.bin/vitest run src/features/saved/saved-timeline.test.tsx tests/integration/saved/video-library.test.ts
```

Behavior-level RED after import scaffolding: 2 files failed, 9 tests failed. The assertions demonstrated:

- seven saves produced zero grouped cards;
- timeline order remained input order instead of timestamp/capture/id order;
- organizing/failed saves had no progressive copy and unsupported had no native Simplified Chinese explanation;
- Home always chose complete instead of due Practice or recent Saved;
- list/detail service did not query the repository, detail was absent, and the HTTP handler returned 501 rather than the authenticated no-store envelope.

## Implementation

- Added owner-validating `SavedVideoSummary`, `SavedVideoDetail`, bounded saved evidence mapping, deterministic timeline ordering, and exact canonical YouTube timestamp links.
- Added a service-role Supabase reader with explicit `user_id` predicates on every source, snapshot, save, artifact, job, segment, review-task, and Home-count query.
- Saved list groups moments by video and omits raw payload/transcript evidence. Detail includes raw saved text, only referenced segment evidence, stored artifacts, and generic user-safe failure messages.
- Added cookie-authenticated no-store Saved API handlers and authenticated Home, Saved list, and Saved detail server pages.
- Home selects one action only: due Practice, then recent unsorted saves, then the complete/empty state.
- Individual mutation controls were not invented because no frozen ignore/delete/practice-from-save API exists in the assigned baseline.

## GREEN evidence

```text
Vitest: 2 files passed, 9 tests passed
ESLint focused paths: exit 0
TypeScript noEmit: exit 0
git diff --check: exit 0
```

The controller-requested personal-product calibration was followed: no database reset, pgTAP, full suite, or production build was run for this isolated UI/query task.

## Remaining risks

- The detail page renders stored artifact content generically; Batch B Task 3 owns the richer candidate-expression interaction.
- Queries intentionally use bounded caps (100 sources/snapshots, 500 saves/jobs/artifacts, 224 referenced segments) and do not yet expose pagination, which is acceptable for the current personal-use scope but should be revisited if the library grows beyond those bounds.
- Browser-level visual/navigation coverage remains for the Batch B integration gate; this task supplies focused component and service/HTTP behavior coverage only.
- Independent review and integration are still required; this handoff is not self-approval.
