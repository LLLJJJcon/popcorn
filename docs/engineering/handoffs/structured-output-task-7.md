# Structured Output Reliability Task 7 Handoff

## Identity and scope

- Plan task: Task 7, Saved Web Analysis Status and Version-Compatible Consumption.
- Product baseline: `cb06a7d`.
- Execution baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`.
- Worktree: `/private/tmp/popcorn-structured-output-task-7`.
- Branch: `codex/structured-output-task-7`.
- No server/API, persistence, prompt/schema, migration, extension, root-config,
  dependency, lockfile, or ledger file was changed.

## Implementation

- Saved analysis now retains the exact job ID returned by POST and uses it in
  every owner-bound status GET.
- Automatic polling runs every second through 60 seconds, then every five
  seconds through five minutes. The one-minute state is informational; at five
  minutes automatic polling stops and one manual `Check status` remains.
- `ready`, `processing`, `gateway_required`, and the three safe terminal
  failure categories are parsed explicitly. Model-output failure has dedicated
  safe copy and cannot be confused with a long-running job.
- Initial Analyze sends `{}`. Only terminal Retry generates
  `crypto.randomUUID()`, and an in-flight guard plus disabled action prevents a
  duplicate POST or UUID while that request is unresolved.
- Timer and fetch work is cancelled on unmount. Consumers continue receiving
  and rendering strict `CandidateExpression[]`; no model wire index is read.
- Saved candidates use the shared Saved-analysis readable-version predicate
  (`v1`/`v2`), and persisted overview uses the shared Overview predicate
  (`v4`/`v5`). Unknown versions remain unavailable and are never guessed.

## TDD evidence

RED command (equivalent direct binary because `pnpm exec` tried to reinstall
the controller-owned shared `node_modules` in this worktree):

```bash
/Users/liangjing/Desktop/Courses/internal\ capstone/Popcorn/node_modules/.bin/vitest run \
  src/features/saved/candidate-list.test.tsx \
  src/features/saved/saved-video-detail.test.tsx
```

RED result: 22 tests executed; 4 failed for the intended missing behavior:

- readable Saved v1 was rejected;
- readable Overview v4 was rejected;
- processing became a false error at 60 seconds;
- terminal `model_output` was collapsed into the generic timing error.

GREEN result for the same focused command: 2 files passed, 22 tests passed.
The fixtures cover 1s-to-5s cadence, the 60s and 5m states, one manual status
check, exact job-ID URLs, one terminal retry UUID while POST is unresolved,
unmount abort, observable Saved v1/v2 and Overview v4/v5 reads, ready domain
candidates, and unknown-version non-rendering.

Typecheck equivalent command:

```bash
/Users/liangjing/Desktop/Courses/internal\ capstone/Popcorn/node_modules/.bin/tsc --noEmit --pretty false
```

Result: exactly the seven recorded baseline TS2741 errors in
`src/features/practice/practice-session.test.tsx` for missing
`savedReturnTarget`; Task 7 added no TypeScript diagnostic.

No full suite, build, browser, database, or real Provider check was run, per
the task brief.

## Consumption and risk

The persisted/public artifact shapes are unchanged. The route remains the sole
authority for version-compatible artifact production; the Saved server
component imports the frozen predicates rather than duplicating version lists.
The client consumes only status envelopes and final domain candidates, so
Saved-to-Practice activation, Vault, and Progress inputs are unchanged.

Residual risk is limited to real browser/network scheduling variance, which is
outside the deterministic fake-timer gate. The five-minute boundary is reached
after the bounded sequence of successful processing responses; any real
request error stops immediately with the existing safe retry UI.

No upstream code was needed. YouTube Digest remains pinned under MIT at
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`. No GPLv3 LLM Wiki code, tests,
prompts, components, or assets were copied.
