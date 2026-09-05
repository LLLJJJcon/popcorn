# Structured Output Task 7 — Review Repair Brief

- Parent task: Structured Output Reliability plan Task 7.
- Parent baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`.
- Parent implementation: `789c787338189a950e192cdce101e469dfc64fe4`.
- Repair worktree: `/private/tmp/popcorn-structured-output-task-7-repair`.
- Repair branch: `codex/structured-output-task-7-repair`.
- Repair baseline: controller commit containing this brief.

## Important findings

1. The 60-second and 5-minute states currently advance only after a GET returns.
   Use independent wall-clock deadline timers starting when processing is
   accepted. At 60 seconds always show background copy. At 5 minutes cancel
   cadence, abort an in-flight GET, and show queued/manual Check status. All
   terminal/error/unmount paths must clear cadence and deadline timers. Add fake
   timer RED for a permanently pending GET and a delayed GET.
2. `findLast` chooses any newest artifact before version/schema validation, so a
   newer unknown or corrupt artifact hides an older readable valid one. Search
   newest-to-oldest for the first artifact whose exact finite version is readable
   and whose current domain schema is valid. Unknown/corrupt artifacts never
   render. Add both Saved candidate and Overview RED for old-valid plus
   new-unknown/new-corrupt sequences.
3. Processing responses accept arbitrary status strings. Both POST and GET must
   accept exactly `pending | leased`. Replace the invalid `queued` fixture and
   add unknown-status rejection RED.

## Allowed files

- `src/features/saved/candidate-list.tsx`
- `src/features/saved/candidate-list.test.tsx`
- `src/features/saved/saved-video-detail.tsx`
- `src/features/saved/saved-video-detail.test.tsx`
- `docs/engineering/handoffs/structured-output-task-7-review-repair.md`

All other files are forbidden, including CSS unless a concrete test proves it
is required, server/API/contracts/prompts/migrations/extension/root config/
dependencies/lockfile/ledger.

## Focused verification

```bash
pnpm exec vitest run src/features/saved/candidate-list.test.tsx src/features/saved/saved-video-detail.test.tsx
pnpm typecheck
git diff --check <parent-implementation>..HEAD
git status --short
```

Use controller locked dependency binaries read-only if needed; do not install.
Baseline retains seven unrelated Practice TS2741 errors; add none. No full
suite/build/browser/DB/Provider. Commit repair plus handoff and return SHA,
RED/GREEN, typecheck differential, risks, clean status. No merge/rebase/push.

No upstream code is needed. Preserve YouTube Digest MIT pin `d03e1f...`; LLM
Wiki GPLv3 pin `723e259...` remains method-only with no copied code/tests/
prompts/components/assets.
