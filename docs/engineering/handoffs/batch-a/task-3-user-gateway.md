# Batch A Task 3 / User Gateway Task 4 Handoff

## Scope and baseline

- Brief: `docs/engineering/briefs/batch-a/task-3-user-gateway.md`
- Worktree: `/private/tmp/popcorn-gateway-learning-artifacts`
- Branch: `codex/popcorn-gateway-learning-artifacts`
- Brief baseline: `0399f9a`
- Integration contract baseline recorded by the brief: `7182f08`

This task implements user-pinned model-gateway learning artifacts for only the
currently watched YouTube video: Overview, Chinese-to-English segment
translation, and selected-Chinese explanation. It does not add another input
source or expose Provider configuration to the extension.

## RED evidence

- Initial server run: the new runtime resolver and learning-artifact suites
  failed because their production modules did not exist.
- Initial extension run: the new fixed Popcorn routing, cross-line selection,
  and no-direct-Provider assertions failed against the historical direct
  Provider path.
- Production adapter RED: focused adapter/runtime tests failed while the
  adapter was deliberately fail-closed.
- Exact selection RED: a tampered explanation context registered as `202`, and
  the worker invoked the runtime resolver before checking persisted evidence.

## Implementation

- Public artifact routes authenticate the Popcorn owner, validate exact
  source/snapshot/segment evidence, pin the unique active gateway
  config/revision/fingerprint, register only through CONTRACT-009, and return a
  short `202` without resolving Vault configuration or calling a Provider.
- Private job input contains only the bounded task payload and gateway pin. It
  contains no origin, path, model, key, header, token, Vault ID, or Provider
  response.
- The worker resolves the exact owner/config/revision/fingerprint immediately
  before invocation. CI selects its fixture before resolver construction.
- Completion and failure use the frozen CONTRACT-009 atomic RPC fences; job and
  result identity uses `gateway:<config fingerprint>` through the frozen
  serializer.
- Explanation context, UTF-16 offsets, segment IDs, and earliest/latest times
  are checked against persisted evidence before runtime Provider resolution.
- The production outbound body uses request-local segment indexes only. Stable
  segment IDs and all database/internal IDs remain server-side; results are
  mapped back to stable IDs before source-grounding validation. The API key is
  used only as the approved exact gateway's bearer header.
- Extension AI actions now use only short authenticated Popcorn API requests.
  The existing service-worker auth ownership and sender gates remain intact.

## Upstream reuse and license

- Preserved and adapted the planned YouTube Digest MIT functions in the
  existing files, including transcript grouping/rendering, selection,
  translation alignment, Overview rendering, `handleFetchTranscript`,
  `pollTranscriptJob`, and the existing background message router.
- `extension/UPSTREAM.md`, the MIT license, and third-party notices were not
  changed.
- LLM Wiki was method-only inspiration. No GPLv3 code, test, prompt, component,
  or asset was copied.

## Verification

- Production adapter focused: 18/18 passed, including request/stream bounds,
  stalled response-stream timeout, sanitized upstream failures, strict
  envelope parsing, request-local index mapping, exact endpoint, and minimized
  outbound payload.
- Task server focused: 105/105 passed across runtime resolver, learning
  artifacts, durable snapshot resolution, and Supadata transcript contract.
- Extension focused: 31/31 passed across auth worker, transcript selection,
  translation, and release boundaries.
- Broad application Vitest: 26 files, 464/464 tests passed.
- TypeScript candidate check: passed with no diagnostics.
- ESLint candidate check: passed with zero errors and zero lint warnings. The
  external dependency workspace emitted only its React-version detection
  environment notice.
- `git diff --check`: passed.

Because this task changes no migration or frozen database contract, the local
database reset/pgTAP gate is intentionally left for the main integration gate
instead of being repeated in this isolated worktree.

## Known risks and delivery gates

- Production DNS/egress enforcement and real Provider smoke testing remain
  Delivery gates. CI uses only injected deterministic fetches or the fixture
  Provider.
- The large `background.js` diff removes historical direct DeepSeek/Supadata
  behavior. Focused auth/release tests protect auth initialization, trusted
  sender gates, storage access restriction, fixed Popcorn routing, and panel/tab
  behavior.
- Root configuration, lockfile, database migrations, generated database types,
  and execution ledger were not modified by this task.
