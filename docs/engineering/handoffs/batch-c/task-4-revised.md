# Batch C Revised Task 4 — Source Deletion Handoff

## Baseline and scope

- Baseline: `8bdfa2a24aa790195d39e1496b80613a94c7fe4e`
- Branch: `codex/popcorn-batch-c-4-revised`
- Worktree: `/private/tmp/popcorn-batch-c-4-revised`
- Allowlist: the application, tests, brief, and handoff files recorded in the
  controller's persistent Task 4 brief.

## RED evidence

Command:

```text
./node_modules/.bin/vitest run tests/integration/deletion/source-deletion.test.ts src/features/saved/delete-source-dialog.test.tsx tests/integration/memory/vault-practice.test.ts
```

Observed before implementation: exit 1. The new deletion suites could not
resolve the absent domain and dialog modules. Three Vault tests also failed
because production still queried `practice_draft_attempts` and required
`expression_occurrences` for a tombstoned sense. Six unchanged tests passed.

## Implemented behavior

- Owner-scoped deletion preview with exact Saved and promoted-expression
  counts and the two frozen modes.
- Generic no-store preview and DELETE handlers.
- Commit-time mode recheck and one sole CONTRACT-016 RPC call.
- Actual Saved detail confirmation that names the source/count/effect,
  requires explicit acknowledgement, and returns to Saved after success.
- Vault reads canonical `public.attempts`; tombstoned expression senses no
  longer require an occurrence or video source and render `Source deleted`.
- Active Vault links, timestamps, evidence, and suggestion behavior remain.

## GREEN evidence

- Required focused Vitest: 3 files, 16 tests passed, exit 0.
- Supplemental unchanged Saved-library regression: 1 file, 5 tests passed,
  exit 0.
- `tsc --noEmit`: exit 0.
- Scoped ESLint from the persistent brief: exit 0 with no warnings.
- `git diff --check` and `git diff --cached --check`: exit 0.

## Risks and follow-up

- The preview and transactional RPC intentionally form an optimistic two-step
  flow. If learning evidence changes between them, the application returns a
  generic conflict or failure instead of attempting a multi-table fallback.
- The title falls back to `Saved YouTube video` only when an owned source has
  no snapshot title. No deleted locator or content is returned by the feature.
- Independent review must confirm the PostgREST inner relationship count and
  the sole-RPC/no-leak boundaries from the baseline-to-HEAD diff.

## License

No YouTube Digest code is relevant or reused. No LLM Wiki GPLv3 code, tests,
prompts, components, or assets are copied; this task uses neither upstream.
