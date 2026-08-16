# Foundation Task 4 Brief — Deterministic mastery, scheduling, and job leasing

## Identity and baseline

- Plan and task: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 4.
- Governing design: `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md`, especially Sections 8.2 and 10.
- Baseline commit: `0beb551beb0645f288ae221919eea67be1bcacc9`.
- Branch: `codex/popcorn-foundation-4`.
- Isolated worktree: `/private/tmp/popcorn-foundation-4`.
- This is a single numbered task. Do not start Foundation Task 5 or any Batch A work.

## File ownership

Allowed to create or modify only:

- `src/server/domain/mastery.ts`
- `src/server/domain/mastery.test.ts`
- `src/server/domain/schedule-review.ts`
- `src/server/domain/schedule-review.test.ts`
- `src/server/domain/lease-job.ts`
- `src/server/domain/lease-job.test.ts`
- `docs/engineering/briefs/foundation/task-4.md` (commit unchanged)
- `docs/engineering/handoffs/foundation/task-4.md` (create and append the handoff)

Forbidden: every other path, including `src/contracts/**`, `supabase/**`, `src/types/database.generated.ts`, root configuration, `package.json`, `pnpm-lock.yaml`, vendored/upstream files, notices, the execution ledger, and checkpoints. Do not modify a frozen contract or migration to make a test pass. Stop and report a concrete contract conflict if one is genuinely unavoidable.

## Interfaces consumed

- Frozen `MasteryState` from `src/contracts/memory.ts`: exactly `tried | reused | owned`.
- Frozen discriminated `KnowledgeJob` and `KnowledgeJobType` from `src/contracts/knowledge.ts`, including direct `userId`, source/save identity, lowercase SHA-256 dedupe key, attempt count `0..20`, and exact lifecycle nullability.
- Task 3 `knowledge_jobs` lifecycle: `pending`, `leased`, `succeeded`, `retryable_failed`, `terminal_failed`; pending/succeeded have no lease/retry/error, leased has only `leaseExpiresAt`, retryable failure has only `nextAttemptAt` and error, terminal failure has only error.
- Product invariants: saving or viewing is never mastery evidence; transitions never lower the highest state; AI/client input cannot choose mastery or due dates; expired leases must be recoverable after worker termination.

## Interfaces produced

- `advanceMastery(current, evidence)` with a narrow server-evidence discriminated union and no clock, database, AI-proposed state, or client-requested target state.
- `scheduleReview(input)` returning a deterministic `ReviewSchedule` with ISO UTC `dueAt` and `intervalDays`.
- `leaseJob(job, now)` returning a typed `LeaseDecision` without mutating its input.
- `nextJobFailure(job, error, now)` returning a schema-compatible retryable or terminal job state without mutating its input.
- A deterministic lowercase SHA-256 result-key function derived unambiguously from job type, source hash, nullable saved-item hash, prompt version, and model version. Use unambiguous canonical/length-prefixed serialization; do not concatenate ambiguous raw values.
- Export and test the fixed operational constants. Unless the governing contracts force a different value, freeze: a five-minute lease, five allowed attempts, one-minute exponential retry base, and one-hour retry cap. Increment the attempt when a job is successfully leased; failure of the fifth leased attempt is terminal.

No function may perform I/O, read the current clock implicitly, access environment variables, call a provider, or mutate the supplied object.

## Required TDD evidence

Write tests first and capture an actual RED run before implementation. At minimum prove:

### Mastery

- `null + valid_original_attempt -> tried`.
- `tried + successful_independent_transfer -> reused`.
- `reused + owned_threshold_met` advances only when there are at least two distinct contexts, two distinct UTC dates, and due Practice evidence.
- `saved_item_created`, views, incomplete ownership thresholds, weak/assisted later evidence, or repeated lower evidence never advances or lowers mastery.
- No transition skips the three-state order; `owned` is absorbing.
- The API does not accept a client target state or AI mastery proposal.

### Review scheduling

At `2026-08-16T00:00:00.000Z`, freeze UTC millisecond arithmetic:

- first tried evidence: one day;
- failed or heavily assisted reuse: one day;
- successful independent reuse: seven days;
- owned maintenance: thirty days.

Prove exact ISO UTC output, interval, immutability, and rejection of an invalid clock instead of silently producing an invalid date. AI/client values cannot override the interval or due date.

### Durable jobs

- Only `pending`, due `retryable_failed`, and expired `leased` jobs can be leased; equality at due/expiry is eligible.
- Future retry, active lease, `succeeded`, and `terminal_failed` are not eligible and preserve the input.
- A successful lease increments `attemptCount`, clears stale retry/error state, and expires at the fixed duration from the injected UTC clock.
- Retry delay is bounded exponential backoff from the completed attempt count; failure before the final allowed attempt returns `retryable_failed`; failure of the final allowed attempt returns `terminal_failed` with no next-attempt/lease timestamp.
- Invalid clocks, non-leased failure input, blank/oversized error categories, and attempt overflow are rejected explicitly.
- Result keys are stable, lowercase 64-hex, distinguish every component including `null` saved-item hash, avoid boundary-collision pairs, and change when job type/source/save/prompt/model changes.

Expected initial RED command:

```bash
pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
```

Record failing assertions/imports and exit status in the handoff before adding production implementations. Then implement the minimum pure domain code and reach GREEN.

## Verification commands

Run and record exact results:

```bash
pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
CI=true pnpm typecheck
CI=true pnpm test:contract
CI=true pnpm test:unit
git diff --check
git status --short
```

Do not run broad unrelated mutation commands. The controller will run the integration gate after review.

## Upstream reuse and license boundary

- YouTube Digest: `zarazhangrui/youtube-digest` at fixed commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. This pure server-domain task has no plan-designated YouTube Digest file or function to reuse. Do not invent a parallel extension implementation and do not change its vendored MIT files or notices.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 at commit `723e259309aea5e3850265b631f80224f66dd9f6`. Only the documented methods—content-addressed result identity and a persistent recoverable queue—may inform the design. Do not copy its GPLv3 code, tests, prompts, components, assets, names, or implementation structure.
- Add no dependency and copy no third-party code. Existing MIT attribution remains untouched; no new license notice should be needed.

## Commit and handoff

Commit the scoped implementation with message `feat: add deterministic mastery and job rules`. Create `docs/engineering/handoffs/foundation/task-4.md` containing: baseline and head SHA, implemented interfaces and constants, upstream/license statement, exact RED/GREEN evidence, broader verification, changed files, risks/follow-up, and confirmation that the worktree is clean. Return the commit SHA, test counts/results, risks, and handoff path to the controller.
