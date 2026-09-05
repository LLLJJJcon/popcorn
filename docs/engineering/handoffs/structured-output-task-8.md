# Structured Output Reliability — Task 8 Handoff

## Scope

- Plan task: Task 8, Practice Non-Pass Feedback and Consistent Revision UX.
- Execution baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`.
- Worktree: `/private/tmp/popcorn-structured-output-task-8`.
- Branch: `codex/structured-output-task-8`.
- No upstream code, GPLv3 code, prompts, tests, components, or assets were copied.

## Implementation

- `EvaluationPanel` derives failed dimensions from scores below 3 and selects the
  lowest score using Accuracy, Naturalness, then Context fit as the stable
  tie-break order.
- A non-pass uses `Keep practising - N areas need work`, emphasizes only failed
  dimensions, identifies `Focus first`, keeps specific server-enriched feedback,
  and retains the existing Vault/mastery/schedule messages.
- Original Practice keeps the learner response and uses the existing revision
  endpoint exactly once for each revised submission.
- Due Practice offers a local `Compare with suggested revision` flow only when a
  valid optional revision exists. It displays the learner rewrite and suggestion
  side by side without making another request or implying another score.
- No server, domain, prompt, schema, persistence, or API response shape changed.

## TDD evidence

- RED command:
  `pnpm exec vitest run src/features/practice/evaluation-panel.test.tsx src/features/practice/practice-session.test.tsx src/features/practice/due-practice.test.tsx`
- RED result: 3 files failed; 6 expected behavior tests failed and 18 existing
  tests passed. Failures were the missing non-pass hierarchy/focus/emphasis,
  action labels, and Due comparison presentation.
- GREEN result before handoff: 3 files passed; 24/24 tests passed.
- Typecheck before handoff: `pnpm typecheck` exited 0. The seven existing
  `savedReturnTarget` fixture diagnostics were corrected by supplying explicit
  `null` values in the touched tests.

## Residual risks

- Verification is intentionally scoped to the three Task 8 component test files
  and TypeScript, per the brief. No browser, Provider, DB, build, or full-suite
  verification was run.
- The Due comparison is intentionally unavailable when the optional natural
  revision is absent; it does not synthesize replacement model content.
