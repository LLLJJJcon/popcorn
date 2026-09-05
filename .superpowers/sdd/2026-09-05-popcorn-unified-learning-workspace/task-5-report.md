# Task 5 handoff: one-action Home workspace

## Scope

- Baseline: `3be45a1`
- Branch/worktree: `codex/popcorn-youtube-learning` at `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn`
- Commit message: `feat: add the action-oriented Home workspace`
- This report belongs to the single Task 5 commit; the resulting SHA is reported by the controller handoff.

## Implemented behavior

- Added the exact bounded `HomeView` projection.
- Added a Home loader that authenticates once, uses one service-role Supabase client, and composes the accepted Saved library, Progress, and owner-scoped model-gateway repositories.
- Selects exactly one primary action in the binding order: missing gateway, due Practice, unsorted Saved material, then YouTube.
- Uses the first deterministic Saved summary as the recent video and copies only the Progress mastery distribution into the Home view.
- Keeps recent Saved and mastery modules visible when gateway setup is primary.
- Does not invoke Providers or return gateway rows, credentials, origins, models, prompts, hidden rows, or additional Home fields.
- Preserves the read-only legacy two-count selector call shape solely for existing regression compatibility; the production Home route always supplies the complete `HomeView` decision input.

## TDD evidence

### RED

Command:

```text
pnpm vitest run src/features/home/home-dashboard.test.tsx src/features/home/home-runtime.test.ts
```

Result: exit 1. Both new suites failed to resolve the intentionally absent `home-dashboard` and `home-runtime` modules. This established the missing runtime/dashboard boundary before production implementation.

During verification, `pnpm typecheck` then exposed three read-only Saved test call sites using the former two-count selector shape, and the focused legacy suite reproduced two incorrect `gateway` results. A narrow compatibility overload was added only after that RED evidence.

### GREEN

Focused Home plus legacy compatibility:

```text
pnpm vitest run src/features/home/home-dashboard.test.tsx src/features/home/home-runtime.test.ts src/features/saved/saved-timeline.test.tsx
```

Result: 3 files passed, 13 tests passed.

Required Step 5 verification:

```text
pnpm vitest run src/features/home tests/integration/saved/video-library.test.ts tests/integration/progress/progress-summary.test.ts
```

Result: 4 files passed, 37 tests passed.

TypeScript:

```text
pnpm typecheck
```

Result: exit 0 (`tsc --noEmit`).

Scoped ESLint:

```text
pnpm eslint 'src/app/(app)/home/page.tsx' src/features/home/home-view.ts src/features/home/home-runtime.ts src/features/home/home-dashboard.tsx src/features/home/home-dashboard.test.tsx src/features/home/home-runtime.test.ts src/features/home/next-action.tsx
```

Result: exit 0 with no findings.

The post-commit `git diff --check 3be45a1..HEAD` result is reported in the controller handoff because it must run after this report and commit exist.

## Risks and follow-up

- The runtime intentionally trusts the accepted Saved service ordering for `recentVideo`; its deterministic timestamp/item/source tie-break behavior remains owned and covered by the accepted Saved integration tests.
- The Home route and authenticated app layout each retain their existing authentication responsibility. Within Task 5's Home loader, authentication is performed exactly once before any repository read.
- Existing unrelated worktree dirt (`next-env.d.ts`, `AGENTS.md`, `CLAUDE.md`, and `.DS_Store` files) was not staged or modified by Task 5.
