# Structured Output Task 3 — Review Repair Brief

- Original execution baseline: `4fde3a2da081fe2eaf0ef82e5ce18bb189664485`.
- Reviewed implementation: `b8ed93c89ae0c5104058a4ec6c132fd3ea28a310`.
- Repair branch/worktree: `codex/structured-output-task-3-repair` at `/private/tmp/popcorn-structured-output-task-3-repair`.

Fix all six independent-review findings with RED evidence:

1. Saved suffix includes literal `[Saved analysis] ` and exact frozen text.
2. A cleared terminal private input `{}` still returns the owner/type/public
   `saved_item_id`-bound safe failed state; a nonempty recoverable input must
   additionally agree. `readJob` validates the supplied job even if an artifact
   is already ready.
3. Registrar replay may return processing only for `pending|leased`. A terminal
   replay returns safe failed status, a succeeded replay returns the strict
   ready artifact, and every other state fails closed—never a contract-invalid
   `processing/terminal_failed` pair.
4. Strictly validate each deterministically enriched candidate independently;
   a 2,001-character evidence candidate is dropped while another valid
   candidate publishes.
5. Repository/private-input/evidence reads start in
   `INTERNAL:persistence`; only after validated evidence is available may local
   model/grounding failures use their stages.
6. Unique exact-match fallback counts overlapping occurrences; `哈哈` in
   `哈哈哈` is ambiguous and rejected.

Allowed files:

- `src/server/ai/prompts/analyze-saved-item.v1.ts`
- `src/server/ai/prompts/analyze-saved-item.v1.test.ts`
- `src/server/domain/confirm-candidate.ts`
- `src/server/jobs/handlers/analyze-saved-item.ts`
- `src/server/jobs/job-types.ts`
- `src/server/repositories/expression-repository.ts`
- `tests/contract/ai/saved-analysis.test.ts`
- `tests/integration/jobs/process-jobs.test.ts`
- `tests/integration/knowledge/source-traceability.test.ts`
- `docs/engineering/handoffs/structured-output-task-3-review-repair.md`

No other file may change. Run only Task 3's four focused files, typecheck
differential, and diff check. Only the same seven unrelated Practice fixture
errors may remain. Commit/report; do not merge/rebase/push. Preserve the strict
Candidate domain shape, no Task 5 reader compatibility, and MIT/GPL boundaries.
