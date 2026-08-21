# Batch C Task 2 implementation brief — due Practice and mastery advancement

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 2.
- Baseline commit: `7e977cff6b695ed8f1faeeb026e0c087837dbea8`.
- Worktree/branch: `/private/tmp/popcorn-batch-c-2`, `codex/popcorn-batch-c-2`.
- Dependency: frozen CONTRACT-015 through `07b1436`; generated database types and `complete_due_practice` RPC are authoritative.

## File ownership

- Allowed create/modify:
  - `src/server/domain/create-transfer-task.ts` and focused test;
  - `src/server/domain/complete-due-practice.ts` and focused test;
  - `src/server/repositories/review-task-repository.ts` and its focused test;
  - `src/features/practice/due-practice.tsx`, `src/features/practice/api.ts`, and focused Practice UI tests;
  - `src/app/api/v1/practice/due/route.ts`;
  - `src/app/api/v1/practice/due/[reviewTaskId]/route.ts`;
  - `src/app/(app)/practice/page.tsx` only if required to render the enriched due view;
  - `tests/integration/practice/due-transfer.test.ts`;
  - this brief and `docs/engineering/handoffs/batch-c/task-2.md`.
- Forbidden: contracts, migrations, generated DB types, root config, lockfile, gateway transport/runtime/Vault code, save/capture routes, extension, Vault/Progress/Saved features, existing unrelated tests, vendor/upstream files.
- No other active Agent owns these files. Task 3 repair owns only Progress repository/dashboard/tests/docs in a separate worktree.

## Consumed and produced interfaces

- Consume authenticated owner, frozen due `review_tasks`, canonical expression/sense/occurrence/prior task summaries, exact gateway pin resolver, bounded structured-JSON gateway, existing evaluation prompt/schema/CI fixture, `advanceMastery`, `scheduleReview`, and typed `complete_due_practice` RPC.
- Produce a meaningful new-context `due_practice` task linked to exactly one review, an interactive due Practice submission UI, evaluated response with recorded `none|hint|model_answer` assistance, and the RPC's canonical attempt/mastery/next-review result.
- SQL is the sole writer and evidence authority. Application code may validate the returned state/schedule against frozen pure rules after the RPC, but must not query external counts to decide mastery or write attempts/events/reviews itself.
- Provider work occurs before the RPC. The RPC never resolves a gateway or API Key. The runtime may use the active user's configured gateway key as authorized; CI must select deterministic fixtures before Vault/runtime/fetch construction.
- This work must not change the save path: extension/background save remains Provider-independent and never waits for transcript/translation/AI.

## Required TDD RED evidence

1. Transfer generation receives the target expression knowledge plus bounded prior context summaries, returns a genuinely different prompt/context, and never exposes a complete answer or accepts AI-proposed mastery/due/interval fields. Invalid, copied, oversized, wrong-language, or forbidden-field Provider output uses a deterministic valid fixture fallback.
2. Existing linked due task replay does not call Provider again; concurrent/materialization conflict retrieves the single owner-linked task. Unlinked/mismatched/cross-owner graphs fail closed.
3. Completion evaluates outside the RPC, forwards the complete evaluation provenance and caller-recorded assistance, calls `complete_due_practice` exactly once, and performs no direct table writes. `passed + assistance=none` is the only independent case.
4. Returned `prior_state/new_state/interval_days/next_due_at` must match `advanceMastery` and `scheduleReview` for failed/assisted, tried→reused, reused→owned or reused retention, and owned maintenance. A parity mismatch fails closed after the RPC and is visible as a generic recoverable API failure.
5. Auth, exact Origin, bounded strict JSON, UUID/review ownership, stale/double completion, Provider failure, gateway-required/revoked, and database conflict responses use the frozen public failure envelope with request ID and `no-store`; no API Key, origin, model internals, prompt, or Provider body leaks.
6. UI withholds a model answer in the task, preserves the learner response on transient failure, records assistance explicitly, prevents duplicate clicks while pending, shows concise evaluation/mastery/next-due results, and offers retry/recovery. Keep English-native/Mandarin-learning copy and YouTube-only scope.

## Implementation constraints

- Reuse the one existing `StructuredJsonGateway`/resolver and evaluation prompt/schema/fixture. Do not duplicate the OpenAI-compatible HTTP client, Vault resolver, or secret handling.
- Bound prior summaries and prompt/output sizes. Query every relation with authenticated `user_id`; reject incomplete or mixed-owner graphs.
- Reuse an existing linked task before Provider egress. Task insert races must converge through the frozen unique review link and owner-scoped reread.
- Do not put a full answer in transfer-task output. AI cannot choose mastery, independent use, schedule, due time, or interval.
- Keep mastery exactly `tried -> reused -> owned`; `owned` is absorbing.
- No generic text/URL/image/screenshot input, video storage, pgvector, graph, chat retrieval, export, or advanced Progress.

## Verification and handoff

- Run focused RED then GREEN commands for the new domain/repository/UI/integration tests.
- Run directly affected Practice regressions, scoped ESLint, `./node_modules/.bin/tsc --noEmit`, `git diff --check`, and baseline-to-HEAD allowlist audit.
- Do not rerun full database, browser, build, or application suites: CONTRACT-015 already passed clean reset and 624/624 pgTAP; this task cannot modify schema/auth/queue/root configuration. Escalate only if a concrete shared-contract regression appears.
- Commit implementation and handoff. Return commit SHA, exact RED/GREEN results, risks, and handoff path.

## Upstream and license

- YouTube Digest `zarazhangrui/youtube-digest` remains pinned at MIT commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; this task should reuse existing adapted project code only and must not create a parallel YouTube implementation.
- LLM Wiki `nashsu/llm_wiki` v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6` is method-only. Prior-context transfer prompting may reuse the documented method, but no GPLv3 code, tests, prompts, components, or assets may be copied.
