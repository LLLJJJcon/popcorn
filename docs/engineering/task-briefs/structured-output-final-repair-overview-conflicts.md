# Structured Output Final Repair C — Overview Source-Index Conflicts

- Finding: final review Important 3.
- Product baseline: `bcfcd2a5d7e3fb5c7e117a73d46c1d2041c888b1`.
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-final-overview`.
- Branch: `codex/structured-output-final-overview`.

## Required behavior

`normalizeOverviewWire` must treat repeated source indexes deterministically:

- exact semantic duplicates for the same `sourceLineIndex` collapse to one;
- conflicting chapters at the same index are all dropped;
- conflicting key quotes at the same index are all dropped;
- a chapter and a key quote may independently cite the same index because they
  are different member families;
- invalid members are dropped independently and valid unique members remain;
- 8-chapter/5-quote bounds apply after conflict resolution so early duplicates
  or conflicts cannot crowd out later valid unique members.

Overview text remains required; server-owned IDs/timestamps/evidence and final
domain schemas remain unchanged. Mirror the already-proven Translation conflict
principle without copying a parallel general framework.

## Allowed files

- `src/server/ai/prompts/youtube-overview.v1.ts`
- `src/server/ai/prompts/learning-artifact-wire.test.ts`
- `docs/engineering/handoffs/structured-output-final-repair-overview-conflicts.md`

All other files are forbidden.

## TDD and focused verification

Write RED for exact duplicate collapse, conflict-all-drop, independent families,
invalid isolation, and post-resolution bounds. Then implement minimum normalizer
logic.

```bash
pnpm exec vitest run src/server/ai/prompts/learning-artifact-wire.test.ts
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

No full suite/browser/DB/Provider. Commit + handoff; return SHA, RED/GREEN,
typecheck/risks/clean. No merge/rebase/push. No upstream code is needed; preserve
the MIT pin and copy nothing from GPLv3 LLM Wiki.
