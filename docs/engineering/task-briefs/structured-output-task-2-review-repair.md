# Structured Output Task 2 — Review Repair Brief

- Original execution baseline: `4fde3a2da081fe2eaf0ef82e5ce18bb189664485`.
- Reviewed implementation: `ec7e6469f6c081f29d400456c4d82a14756e745c`.
- Repair branch/worktree: `codex/structured-output-task-2-repair` at `/private/tmp/popcorn-structured-output-task-2-repair`.

Fix only the two substantive independent-review findings:

1. Overview plain-text fallback must accept only unfenced, JSON-free English
   prose. Add RED fixtures for a `~~~markdown` fence and the broken fragment
   `"overview":"A summary."}`; both must fail at output parsing, while ordinary
   plain prose remains accepted.
2. Database/private-input/evidence reads happen in persistence phase. A thrown
   read in each Overview, Translation, and Explanation handler must become
   `INTERNAL:persistence`, terminal, and never `model_output`. After evidence is
   successfully read, actual model wire/grounding failures keep their safe
   model stages. Add RED for all three handlers.

Allowed files:

- `src/server/ai/openai-compatible-provider.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `src/server/jobs/handlers/translate-segments.ts`
- `src/server/jobs/handlers/explain-selection.ts`
- `src/server/ai/prompts/learning-artifact-wire.test.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/structured-output-task-2-review-repair.md`

No other file may change. Run only Task 2's two focused files, typecheck
differential, and diff check. Only the same seven unrelated Practice fixture
errors may remain. Commit/report; do not merge/rebase/push. Preserve MIT/GPL
boundaries and unchanged domain artifacts.
