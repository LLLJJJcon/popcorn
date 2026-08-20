# Batch B Task 2: Home and video-grouped Saved library

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 2.
- Baseline commit: `bc02122`.
- Worktree: `/private/tmp/popcorn-batch-b-2`.
- Branch: `codex/popcorn-batch-b-2`.

## Allowed files

- `src/features/home/next-action.tsx`
- `src/features/saved/api.ts`
- `src/features/saved/video-card.tsx`
- `src/features/saved/saved-timeline.tsx`
- `src/features/saved/processing-state.tsx`
- `src/app/(app)/home/page.tsx`
- `src/app/(app)/saved/page.tsx`
- `src/app/(app)/saved/[videoSourceId]/page.tsx`
- `src/app/api/v1/saved/route.ts`
- `src/app/api/v1/saved/[videoSourceId]/route.ts`
- `src/features/saved/saved-timeline.test.tsx`
- `tests/integration/saved/video-library.test.ts`
- `docs/engineering/handoffs/batch-b/task-2.md`

All other paths are forbidden. Do not edit contracts, migrations, generated types, root config, lockfiles, ledger, or Batch B Task 1/4 files.

## Interfaces and product rules

- Consume existing owner-scoped `video_sources`, latest `video_snapshots`, `saved_items`, `generated_artifacts`, `knowledge_jobs`, and candidate-analysis artifacts.
- Produce internal `SavedVideoSummary`, `SavedVideoDetail`, and one Home next action without changing shared contracts.
- Seven moments from one owner/video yield one card. List responses never include a full transcript.
- Detail returns only bounded evidence tied to saved items, stored overview/chapters/quotes/translations/candidates, and user-safe processing state/errors.
- Raw saved text remains visible while organizing, unsupported, retrying, or failed.
- Timeline order is video timestamp then capture time with a deterministic tie breaker.
- Unsupported explains native Simplified Chinese requirement.
- Home chooses exactly one primary action: due Practice first, then an unsorted save, then an empty/complete state.
- Pages/routes require the existing authenticated Web session pattern and explicit owner filters even when a service client is used. User B must not observe user A source/detail.
- Detail links to canonical YouTube watch time and permits individual ignore/delete/practice actions only where the existing frozen APIs support them; do not invent a batch import or process-all flow.
- Navigation remains Home, Saved, Practice, Vault, Progress. No generic URL/text/image input or advanced Progress.

## TDD RED

Write the two planned tests first. Expected RED must prove at least:

- seven same-video saves currently have no grouped Saved query/view;
- timestamp/capture deterministic ordering is absent;
- raw text progressive states and native-Chinese unsupported copy are absent;
- Home due-Practice precedence is absent;
- user B detail access fails closed and list DTO excludes full transcript.

Run:

```bash
pnpm exec vitest run src/features/saved/saved-timeline.test.tsx tests/integration/saved/video-library.test.ts
```

Record the failing assertions, not only missing-module errors.

## GREEN verification

```bash
pnpm exec vitest run src/features/saved/saved-timeline.test.tsx tests/integration/saved/video-library.test.ts
pnpm exec eslint src/features/home src/features/saved 'src/app/(app)/home' 'src/app/(app)/saved' src/app/api/v1/saved tests/integration/saved/video-library.test.ts
pnpm exec tsc --noEmit --pretty false
git diff --check
git status --short
```

Do not run DB reset/pgTAP/full application/build: this task changes no migration, secret, queue, or shared contract. The controller will run the Batch B candidate gate once.

## Upstream and license

- No YouTube Digest UI is copied into the Web app; consume the already persisted Popcorn data contracts.
- LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6` contributes only the method idea of Raw Source -> Structured Knowledge and source traceability. Do not copy GPLv3 code, tests, prompts, components, assets, Wiki links, Markdown filesystem, vectors, or review UI.

## Handoff

Commit only this task. Return commit SHA, RED/GREEN evidence, remaining risks, and `docs/engineering/handoffs/batch-b/task-2.md`. Do not self-approve.
