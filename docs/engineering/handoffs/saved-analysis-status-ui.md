# Saved analysis status UI handoff

- Implementation commit: `e90fc2f2cf98848b4dbf8303a495b6568704c292`
- Branch: `codex/saved-analysis-status-ui`
- Baseline: `c8495c9ac634e98061f04ea2db8bd97cd71bbb7c`

## Outcome

- Added a compact analysis-status panel for missing candidate analysis.
- Idle state uses the requested guidance and `Analyze` action.
- Pending state uses the requested copy, a disabled `Analyzing…` action, an accessible indeterminate progress indicator, and reduced-motion handling.
- Error retry and gateway setup remain actionable without changing recovery, polling, or activation behavior.
- Ready saved moments now show a compact `Saved` status instead of `Ready to learn.`
- No upstream code, components, prompts, or assets were reused.

## RED / GREEN evidence

- Baseline drift check: `pnpm vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx`
  - Initial baseline result: 15 passed, 3 failed.
  - The failures were stale test expectations for the existing saved return URL and YouTube link accessible names. They were aligned to the current production contract without changing production behavior; the corrected baseline was 18 passed, 0 failed.
- RED: `pnpm vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx`
  - Result: 10 failed, 11 passed.
  - Expected failures covered the absent `Analysis status` region/status semantics, old idle and pending copy/action labels, absent progress indicator, and `Ready to learn.` status.
- GREEN: `pnpm vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx`
  - Result: 21 passed, 0 failed.
- Related saved-detail regression check: `pnpm vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx src/features/saved/saved-video-detail.test.tsx`
  - Result: 24 passed, 0 failed.
- Full suite: `pnpm test` (outside the sandbox so loopback integration fixtures could bind)
  - Unit: 30 files, 307 passed.
  - Contract: 6 files, 182 passed.
  - Integration: 25 files, 405 passed.
- Lint: `pnpm lint`
  - Result: 0 errors, 3 pre-existing warnings outside the changed files.
- Typecheck: `pnpm typecheck`
  - Result: blocked by 7 pre-existing errors in `src/features/practice/practice-session.test.tsx`; every saved-feature type error exposed during this task was corrected.
- Diff hygiene: `git diff --check`
  - Result: passed.

## Files changed

- `src/features/saved/candidate-list.tsx`
- `src/features/saved/processing-state.tsx`
- `src/features/saved/saved-workspace.module.css`
- `src/features/saved/candidate-list.test.tsx`
- `src/features/saved/saved-timeline.test.tsx`
- `src/features/saved/saved-video-detail.test.tsx`
- `docs/engineering/task-briefs/saved-analysis-status-ui.md`
- `docs/engineering/handoffs/saved-analysis-status-ui.md`

## Risks

- The panel is covered by DOM behavior and accessibility tests but was not visually inspected in a signed-in browser session.
- Repository-wide typecheck remains red for the unrelated pre-existing practice-session fixture drift noted above.
