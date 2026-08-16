# Foundation Task 4 Handoff

- Status: DONE
- Plan and task: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 4
- Worktree and branch: `/private/tmp/popcorn-foundation-4`, `codex/popcorn-foundation-4`
- Baseline SHA: `0beb551beb0645f288ae221919eea67be1bcacc9`
- Task HEAD: the Git commit containing this handoff, with subject `feat: add deterministic mastery and job rules`; its SHA is returned to the controller because a commit cannot embed its own content-derived SHA

## Implemented

- `advanceMastery(current, evidence)` implements monotonic `tried -> reused -> owned` transitions from a narrow server-evidence union. Saves, views, failed/assisted reuse, incomplete ownership thresholds, and repeated lower evidence cannot advance or lower mastery.
- `scheduleReview(input)` assigns fixed 1-, 7-, or 30-day intervals using an injected canonical UTC clock and millisecond arithmetic. Invalid clocks are rejected.
- `leaseJob(job, now)` leases only pending, due-retry, or expired-lease jobs, increments the attempt, clears stale retry/error fields, and assigns a five-minute lease without mutating the input.
- `nextJobFailure(job, error, now)` applies bounded exponential retry and makes the fifth leased attempt terminal while preserving the frozen lifecycle nullability.
- `createJobResultKey(input)` returns a lowercase SHA-256 key over length-prefixed, tagged job type, source hash, nullable saved-item hash, prompt version, and model version components.
- Exported operational constants: `LEASE_DURATION_MS = 300000`, `MAX_JOB_ATTEMPTS = 5`, `RETRY_BASE_DELAY_MS = 60000`, and `RETRY_MAX_DELAY_MS = 3600000`.

## Upstream provenance used

- YouTube Digest `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`: no plan-designated source file or function applies to this pure server-domain task. No vendored MIT source or notice was changed.
- LLM Wiki `nashsu/llm_wiki` v0.6.9 at `723e259309aea5e3850265b631f80224f66dd9f6`: method-only provenance for content-addressed result identity and a durable recoverable queue. No GPLv3 code, tests, prompts, components, assets, names, or implementation structure was copied.
- No dependency or license notice was added.

## Interfaces consumed and produced

- Consumed frozen `MasteryState`, `KnowledgeJob`, and `KnowledgeJobType` types without modifying their contracts.
- Preserved the Task 3 lifecycle shapes and direct job identity/ownership fields.
- Produced only pure functions and types under `src/server/domain/`; there is no I/O, implicit clock, environment access, provider call, or input mutation.

## Files changed

- `docs/engineering/briefs/foundation/task-4.md` (controller brief, committed unchanged)
- `docs/engineering/handoffs/foundation/task-4.md`
- `src/server/domain/mastery.ts`
- `src/server/domain/mastery.test.ts`
- `src/server/domain/schedule-review.ts`
- `src/server/domain/schedule-review.test.ts`
- `src/server/domain/lease-job.ts`
- `src/server/domain/lease-job.test.ts`

## TDD evidence

### RED

The three test files were created before any production domain module.

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 1
Test Files 3 failed (3)
Tests no tests
Failed imports: ./mastery, ./schedule-review, ./lease-job did not exist
```

The failures were caused solely by the absent Task 4 implementation modules, not by a typo or unrelated failure.

### GREEN

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 0
Test Files 3 passed (3)
Tests 52 passed (52)
```

The tests cover all required transitions and exclusions, exact schedule instants, immutability, invalid clocks, job eligibility at equality boundaries, attempt overflow, retry/terminal lifecycle, error bounds, operational constants, stable result keys, nullable saved-item identity, and ambiguous-boundary resistance.

## Broader verification

Fresh pre-commit verification:

```text
$ CI=true pnpm typecheck
exit 0; tsc --noEmit

$ CI=true pnpm test:contract
exit 0; Test Files 1 passed (1); Tests 128 passed (128)

$ CI=true pnpm test:unit
exit 0; Test Files 6 passed (6); Tests 61 passed (61)

$ git diff --check
exit 0

$ git status --short
only the eight scoped Task 4 paths were untracked before commit
```

The local dependency directory was temporarily unavailable after pnpm attempted an unnecessary network refresh. Verification used the integration worktree's installed `node_modules`, whose `pnpm-lock.yaml` SHA-256 exactly matched this worktree, then restored the original ignored local directory. No dependency, package, lockfile, or root configuration changed.

## Contract or migration changes requested

None. Frozen contracts, migrations, generated database types, root configuration, package metadata, lockfile, ledger, upstream files, and later-task files were not modified.

## Risks and follow-up

- The future durable worker must atomically persist the leased state and retain explicit `userId` scope; these pure functions do not perform persistence.
- Operational retry is capped at five leases even though the frozen transport schema permits an attempt count up to 20 for validation compatibility. A sixth lease is rejected explicitly.
- If a fifth lease expires after worker termination, the processor must classify that exhausted job rather than attempting a sixth lease.
- Review scheduling deliberately requires a canonical millisecond UTC `Z` clock from the server. Database timestamps used only for eligibility remain governed by the frozen contract.
- Immediately after the commit, the implementer runs `git status --short` and reports the clean result with the actual commit SHA to the controller.

## Independent review corrective follow-up

This corrective iteration is based on Task 4 commit `0b4cd13e9a578ec5d3622666d92d25fd368ec29e` and addresses two Important findings without changing any frozen contract, migration, generated type, root configuration, package, lockfile, upstream file, or later-task file.

### Durable final-lease recovery

`LeaseDecision` now has an explicit `exhausted` branch containing a schema-compatible `terminal_failed` job. An otherwise-eligible pending, due-retry, or expired-lease job already at `MAX_JOB_ATTEMPTS` is terminalized with:

- the stable `JOB_RETRY_EXHAUSTED` error category;
- `nextAttemptAt: null` and `leaseExpiresAt: null`;
- the injected `updatedAt` clock;
- unchanged identity and `attemptCount`;
- no input mutation and no sixth lease.

An active fifth lease remains `not_eligible` until its expiry boundary. Equality and past-expiry are both exhausted deterministically, so worker termination cannot strand a final lease in a throw/retry loop.

### Frozen UTF-16 string semantics

Error categories, `promptVersion`, and `modelVersion` now apply the frozen Zod semantics to the original JavaScript string:

- `.trim()` is used only to prove the original value is nonblank;
- the original string's UTF-16 `.length` must be at most 100;
- accepted values, including leading/trailing whitespace, remain byte-for-byte unchanged in the failure state or result-key serialization.

Regression coverage includes 100 versus 101 UTF-16 units, 50 versus 51 astral characters, a 101-unit value consisting of 100 spaces plus `X`, and accepted 100-unit spaced values preserved exactly.

### Corrective RED/GREEN evidence

Tests were changed before production code. Against `0b4cd13e9a578ec5d3622666d92d25fd368ec29e`:

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 1
Test Files 1 failed | 2 passed (3)
Tests 9 failed | 56 passed (65)
```

The nine expected failures were four otherwise-eligible max-attempt jobs throwing instead of terminalizing, one whitespace-preservation failure, two over-limit error-category failures, and two astral prompt/model version boundary failures.

After the minimal corrective implementation:

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 0
Test Files 3 passed (3)
Tests 65 passed (65)

$ CI=true pnpm typecheck
exit 0; tsc --noEmit

$ CI=true pnpm test:contract
exit 0; Test Files 1 passed (1); Tests 128 passed (128)

$ CI=true pnpm test:unit
exit 0; Test Files 6 passed (6); Tests 74 passed (74)
```

The remaining integration responsibility is unchanged: a worker receiving `kind: "exhausted"` must persist the supplied terminal state atomically under the job's explicit `userId` scope.

## Lossless UTF-16 result-key corrective follow-up

This corrective iteration is based on `5f500ecadc6d0f7069999c2bc56eca01016a3aec`. Review demonstrated that Node's UTF-8 string encoding replaces a lone high surrogate, lone low surrogate, and literal U+FFFD with the same UTF-8 replacement bytes. The prior string-framed canonical form therefore produced identical SHA-256 keys for three distinct accepted JavaScript strings.

### Corrective RED/GREEN evidence

Regression tests were added before changing serialization. Against `5f500ecadc6d0f7069999c2bc56eca01016a3aec`:

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 1
Test Files 1 failed | 2 passed (3)
Tests 2 failed | 65 passed (67)
```

Both failures were exact result-key collisions: the three `promptVersion` values and the same three `modelVersion` values each produced a key set of size 1 instead of 3.

After the lossless binary framing implementation:

```text
$ pnpm vitest run src/server/domain/mastery.test.ts src/server/domain/schedule-review.test.ts src/server/domain/lease-job.test.ts
exit 0
Test Files 3 passed (3)
Tests 67 passed (67)

$ CI=true pnpm typecheck
exit 0; tsc --noEmit

$ CI=true pnpm test:contract
exit 0; Test Files 1 passed (1); Tests 128 passed (128)

$ CI=true pnpm test:unit
exit 0; Test Files 6 passed (6); Tests 76 passed (76)
```

Existing null, component-change, cross-field, ambiguous-boundary, stability, and lowercase 64-hex assertions remain green.

### Canonical binary format

Every ordered component is encoded as one deterministic frame:

```text
uint32le name_byte_length
UTF-8 field-name bytes
uint8 value_kind                # 0 = null, 1 = string
uint32le value_byte_length      # zero for null
UTF-16LE original value bytes   # absent for null
```

Frames are concatenated in the fixed order `schema`, `jobType`, `sourceHash`, `savedItemHash`, `promptVersion`, `modelVersion` and hashed as binary with SHA-256. The explicit kind marker distinguishes null from an empty string, both name and value lengths prevent component-boundary ambiguity, fixed little-endian lengths make the byte stream process-independent, and UTF-16LE preserves every original JavaScript code unit without Unicode normalization or replacement.

This changes every result-key digest from the pre-freeze Task 4 implementation because the canonical serialization format changed. No production provider results exist at Foundation time; all future producers and cache lookups must consume this single `createJobResultKey` implementation rather than reconstructing its byte format independently.
