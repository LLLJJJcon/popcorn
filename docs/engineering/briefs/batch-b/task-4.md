# Batch B Task 4 brief — learner-first Use It Now

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 4.
- Functional baseline: `602bbdb`; integration worktree: `/private/tmp/popcorn-youtube-learning`.
- Isolated implementation worktree: `/private/tmp/popcorn-batch-b-4`.
- Implement only candidate activation, original Chinese response evaluation, and revision history. Task 3 will later supply the same candidate-selection payload; Task 5 owns canonical Vault/mastery promotion.

## Allowed files

- Create: `src/features/practice/practice-session.tsx`
- Create: `src/features/practice/evaluation-panel.tsx`
- Create: `src/features/practice/api.ts`
- Create: `src/server/ai/prompts/activate.v1.ts`
- Create: `src/server/ai/prompts/evaluate.v1.ts`
- Create: `src/server/domain/create-practice-task.ts`
- Create: `src/server/repositories/attempt-repository.ts`
- Create: `src/app/(app)/practice/[taskId]/page.tsx`
- Create: `src/app/api/v1/practice/tasks/route.ts`
- Create: `src/app/api/v1/practice/attempts/route.ts`
- Create: `src/app/api/v1/practice/attempts/[attemptId]/revisions/route.ts`
- Create: `src/features/practice/practice-session.test.tsx`
- Create: `tests/integration/practice/attempts.test.ts`
- Create: `docs/engineering/handoffs/batch-b/task-4.md`

Every other path is forbidden. In particular, do not modify shared contracts,
`src/server/ai/structured-json-gateway.ts`, the OpenAI-compatible adapter, model-gateway
runtime/settings code, jobs/Saved files, migrations, generated types, root config,
lockfiles, ledger, or upstream/vendor files.

## Frozen inputs and interfaces

- Consume `CandidateExpressionSchema`, `PracticeTaskSchema`, `EvaluationResultSchema`,
  and `AttemptRecordedSchema`; do not create parallel public contracts.
- Consume `StructuredJsonGatewayResolver`. Live code resolves the active exact owner pin
  immediately before each activation/evaluation egress and passes that owner/config/
  revision/fingerprint pin to the shared resolver. CI selects deterministic fixtures
  before active-pin lookup, Vault, or fetch.
- Consume controller CONTRACT-012 tables `practice_drafts` and
  `practice_draft_attempts`. A task selection is exactly
  `{savedItemId,candidateArtifactId,candidateIndex}`; the repository must owner-filter
  the artifact and rely on the frozen database candidate/source/save binding.
- The selected artifact must be `saved_item_analysis`; parse its strict candidate list
  and use the exact indexed candidate. Never accept target expression, source, task ID,
  user ID, model, provenance, scores, due date, or mastery state from the client.
- Runtime routes reuse cookie-only Web authentication, scoped gateway-settings env,
  service-role server client, standard API envelopes, JSON/content bounds, same-origin
  mutation checks, and `Cache-Control: no-store` patterns already in the repository.

## Produced behavior

### Task activation

- `POST /api/v1/practice/tasks` accepts only the three selection identifiers, resolves
  the authenticated owner, exact artifact/candidate and current gateway, and creates one
  durable draft before returning it. A replay for the same selection must not create a
  second active draft or a second future expression identity.
- The task contains the exact target expression, a bounded Chinese situation, English
  instructions and English goal, `en -> zh-CN`, and no model answer/example response.
- Live rows persist prompt version plus the exact gateway model/config/revision/
  fingerprint returned for that egress. CI fixture rows use the frozen all-null
  provenance form and must not touch the runtime resolver, Vault, or fetch.
- A provider/network/schema/grounding failure creates no draft, Vault, canonical practice,
  attempt, mastery, or review row and returns only a normalized non-secret error.

### Evaluation and revisions

- `POST /api/v1/practice/attempts` accepts only `{taskId,responseChinese}` for revision 1.
  Reject empty, English-only, oversized, or malformed input before any Provider call.
- Evaluation output is strict `EvaluationResult`: separate integer 1–5 accuracy,
  naturalness, and contextual-fit scores with bounded English feedback, plus passed,
  independent use, and assistance. This implementation records `assistanceLevel="none"`;
  the model may not invent or upgrade assistance/independence.
- Persist every schema-valid evaluation, including a learner result with `passed=false`,
  as an append-only draft attempt. Provider/network/schema-invalid output persists no
  attempt. Neither case creates canonical attempts, Vault, mastery, or due Practice.
- `POST /api/v1/practice/attempts/[attemptId]/revisions` resolves the original attempt's
  exact owner/draft, appends the next positive revision, and preserves all prior rows.
  Concurrent duplicate revision conflicts fail closed without overwriting history.
- Live evaluation rows persist the exact five-field gateway provenance; CI uses all-null.
  Resolve live credentials for every outbound call so revocation prevents future egress.
- The client retains the learner's submitted Chinese after recoverable errors, displays
  separate feedback dimensions after valid evaluation, and offers revision/resubmission.
  No complete model answer appears before the first submission.
- Return a schema-valid `AttemptRecorded` view using the draft's preallocated
  `future_user_expression_id`; this is an event/view only. Task 5 alone may promote it.

## Explicit prohibitions

- Do not create/update `user_expressions`, canonical `practice_tasks`, canonical
  `attempts`, `mastery_events`, or `review_tasks`.
- Do not add text, generic URL, image, screenshot, file, or non-YouTube inputs.
- Do not add pgvector, graph, chat/retrieval, export, Progress, scheduling, or mastery logic.
- Do not put API keys, Vault IDs, origins, URLs, headers, prompts, request bodies, raw
  provider output, or learner text in logs/errors/job records.
- Do not duplicate the gateway transport or copy GPLv3 LLM Wiki code, prompts, tests,
  components, or assets.

## Required TDD evidence

RED must demonstrate failures before implementation for at least:

- activation has no model answer and persists before return;
- wrong owner/save/artifact/index and malformed candidate output fail closed;
- CI performs zero active-pin/Vault/fetch calls; live uses exact owner pin and a revoked
  configuration prevents the next egress;
- empty/English-only response causes zero Provider calls;
- schema-invalid Provider output creates zero draft attempt and zero canonical evidence;
- valid evaluation stores distinct 1–5 English-feedback dimensions and exact provenance;
- failed learner evaluation is retained as draft history but creates no mastery evidence;
- revision preserves original history, owner isolation, and learner text on recoverable
  failure; no complete answer is rendered before the first submit;
- replayed task selection is idempotent and concurrent revision collision never overwrites.

## Verification

```bash
./node_modules/.bin/vitest run \
  src/features/practice/practice-session.test.tsx \
  tests/integration/practice/attempts.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

Do not repeat database reset/full pgTAP, the full application suite, production build, or
browser tests: the shared migration already passed its clean 533-test gate, and Task 4 may
not change shared files. Run a broader gate only if a concrete task-local risk requires it.

## Upstream reuse and license

- YouTube Digest: `zarazhangrui/youtube-digest` at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. Adapt only the source-grounding and
  structured-output discipline identified by the plan from `prompts/explain.md` and
  `prompts/note-cleanup.md`; keep Popcorn's Mandarin-in-English learning goal and write
  new prompts/tests. Record the exact adapted method in the handoff.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at
  `723e259309aea5e3850265b631f80224f66dd9f6`. Method only: Raw Source -> Structured
  Knowledge -> Learning Evidence. Copy no GPLv3 source, prompt, test, component, asset,
  queue, Markdown/wiki, vector, or runtime implementation.

## Handoff

Commit only the allowlisted files. The handoff must include RED/GREEN evidence, commit SHA,
route/domain/repository interfaces, exact gateway/provenance behavior, no-premature-Vault
proof, upstream/license method record, remaining risks, and focused verification output.
Do not self-approve; the controller will assign a fresh read-only review Agent.
