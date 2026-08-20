# Batch B Task 1 handoff

## Scope and commits

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 1.
- Functional baseline: `1e0d254`; task brief baseline: `cb20d893`.
- Worktree: `/private/tmp/popcorn-batch-b-1`; branch: `codex/popcorn-batch-b-1`.
- Only Task 1 allowlisted processor, handler, prompt, tests, and this handoff changed.

## TDD evidence

Behavior RED was captured before implementation:

- the internal route returned `apiKey`/`providerBody` fields and accepted a batch above five;
- saved-item analysis behavior produced seven failures with the explicit not-implemented handler;
- the provider cache failed exact fixture-cache and live-revocation behavior;
- deterministic saved-analysis keys and runtime handler composition each failed;
- gateway-aware registration was absent, then the active-owner-pin variant failed all three
  owner/absence/replay cases before the helper resolved the pin itself.

Focused GREEN before the final gate:

```text
tests/integration/jobs/process-jobs.test.ts + recovery.test.ts
2 files passed; 21 tests passed
TypeScript noEmit: exit 0
```

Final brief gate after the cross-owner regression was added:

```text
4 focused test files passed; 47 tests passed
TypeScript noEmit: exit 0
git diff --check: exit 0
```

Independent-review repair RED was captured against task commit `748d0d5`:

```text
tests/integration/jobs/process-jobs.test.ts
1 file failed; 5 new regressions failed; 19 existing tests passed
```

The failures proved the validator accepted NFKC-compatible text, ASCII substitutions
for persisted full-width punctuation, inserted whitespace in evidence/expression, and
provider-reversed segment order. After the minimal exact-grounding repair, that file
passed 24/24. The repair's final focused gate was:

```text
4 focused test files passed; 52 tests passed
TypeScript noEmit: exit 0
git diff --check: exit 0
```

Controller integration then exposed an App Router boundary failure at baseline
`26a525b`: plain `tsc` passed without generated route types, while the fixed-environment
Next build failed because `route.ts` exported the testable `createProcessorHandlers`
factory. The route-export regression was written first and failed with the actual module
exports `["POST", "createProcessorHandlers"]` instead of `["POST"]`. The minimal repair
moved the factory without copying logic into `process-jobs.ts` and changed the tests to
import it from that server module. Fresh repair GREEN evidence:

```text
route-export regression: 1 passed
4 focused test files: 53/53 passed (52 retained + 1 regression)
TypeScript noEmit with generated Next route types: exit 0
fixed-environment Next production build: exit 0; 19/19 static pages generated
```

## Implementation

- The processor and authenticated internal route now enforce a maximum batch of five and
  return counts only. Existing resolve-snapshot, Overview, translation, and explanation
  handlers remain registered and unchanged in behavior.
- `analyze_saved_item` reads strict private input only after checking the claimed owner and
  job/save identity. It loads the exact owner/source/save/snapshot plus at most 32 explicit
  or 12 timestamp-near transcript segments, then validates one to three candidates against
  persisted Chinese evidence and exact referenced timestamp bounds. Candidate segment IDs
  must follow the persisted transcript-position order. Evidence and expression occurrence
  use exact source strings: no Unicode normalization, punctuation substitution, or whitespace
  removal can turn provider output into accepted evidence.
- Analysis success calls only `complete_gateway_learning_artifact_job`; retry and terminal
  failure call only `transition_learning_artifact_failure`. Terminal failure clears private
  input, while raw saves are never changed. Atomic completion/result-key uniqueness makes
  replay unable to publish a second artifact.
- Result keys include transcript hash, saved-item ID, snapshot ID, prompt version, and the
  immutable gateway fingerprint.
- The runtime uses a task-local deterministic structured-JSON fixture in CI. Live work
  resolves the claimed owner and immutable pin through `StructuredJsonGatewayResolver`.
  The processor-local cache is capped at five and enabled only for fixtures; live resolution
  is repeated before every future outbound request so revocation wins.
- `createSupabaseSavedItemAnalysisRegistrar(client).register(...)` is the downstream
  registration interface. It accepts owner/source/save/snapshot/transcript/prompt/time,
  calls `resolve_active_user_model_gateway_pin` for that exact owner, returns `null` when no
  active pin exists, then calls only `register_gateway_learning_artifact_job` with the
  immutable pin and deterministic input/key. Replays return the frozen RPC's existing job.
- Registration is intentionally not invoked from resolve-snapshot completion. Saving and
  transcript readiness must succeed even when a personal model gateway is absent or revoked.
  Batch B Task 3's saved-item candidates route should invoke this helper when an artifact is
  absent, providing a recovery trigger after the user configures a gateway.

## Upstream reuse and license

- Retained the existing Popcorn adaptation of YouTube Digest
  `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`
  `background.js:pollTranscriptJob`: completed/failed/queued/active and expiry-aware polling.
  Task 1 did not replace or fork that implementation.
- Adapted the validation idea from the same MIT source's
  `background.js:validateAndFixTimestamps`: candidate timestamps are accepted only when they
  equal the minimum start and maximum end of the exact referenced persisted segments. The
  code was independently written for Popcorn's typed artifact/evidence model.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6` contributed only the
  Raw Source -> Structured Knowledge -> Learning Evidence method. No GPLv3 code, tests,
  prompts, components, assets, Markdown/wiki, vector, or queue implementation was copied.

## Risks and next consumer

- CI never contacts a real provider. Live model egress remains a Delivery-only manual check.
- Task 3 must consume the exported registrar when candidates are absent; this task deliberately
  does not add a user-facing trigger outside its file ownership.
- Timestamp-near evidence is bounded and owner/snapshot scoped when a save has no explicit
  segment ID. It is not a whole-video ingest, but candidate quality for very sparse subtitles
  remains provider-dependent and still passes through exact grounding validation.
- Per the personal-product verification calibration, no DB reset, full pgTAP, full suite,
  or unrelated security gate was repeated. A focused production build was necessary for this
  repair because generated App Router types were the exact integration failure surface.

Independent review is still required; this handoff is not self-approval.
