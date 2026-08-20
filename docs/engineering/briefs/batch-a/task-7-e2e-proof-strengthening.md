# Batch A Task 7 repair: strengthen end-to-end proof

## Scope

- Plan: Batch A Task 7 integration gate.
- Baseline commit: `58e4292`.
- Worktree: assigned by the controller.
- Trigger: final independent review found four mutation-surviving gaps in the Chromium acceptance test.

## Allowed files

- `tests/e2e/extension/fixtures.ts`
- `tests/e2e/extension/acquisition-save.spec.ts`
- `docs/engineering/handoffs/batch-a/task-7-e2e-proof-strengthening.md` (create)

All production files, Playwright/root config, lockfiles, migrations, upstream log and ledger are forbidden.

## Required proof

1. **Six exact cloud payloads**
   - Expose immutable captured fixture events by `kind`.
   - Assert the complete allowed field set and exact expected values for `video`, `player_moment`, `subtitle_row`, `subtitle_selection`, `key_quote`, and `ai_explanation`.
   - Assert distinct client event IDs and one event per intentional primary save kind before the rapid-recovery phase.
   - Do not merely assert the six `kind` strings.

2. **No save side effects**
   - During each save action, assert the YouTube watch URL and Side Panel URL remain unchanged.
   - Fail on any dialog and assert the persistent context page count does not grow.
   - Assert no form becomes visible or is opened by a save.
   - Keep the existing exact playback-state equality assertion.

3. **No synchronous Provider/artifact work while saving**
   - Count requests by exact approved Popcorn path category.
   - For each save click/keyboard action, snapshot transcript, translation, overview and explanation request counts immediately before the save and assert they are unchanged after the corresponding sync acknowledgement.
   - User actions that intentionally request Overview or Explanation may increment counts before their later save button is clicked; their save buttons must not increment them again.
   - Origin-only egress checks remain as a separate assertion.

4. **Both rapid events recover by original identity**
   - Record the two new rapid `player_moment` client event IDs created while acknowledgements are dropped.
   - Prove they are distinct, each was attempted before worker termination, each is retried with the same original ID after alarm recovery, each receives a successful acknowledgement, and neither is silently discarded.
   - Replace the weak “some attempt count > 1” predicate with an all-rapid-event assertion.

## RED/mutation evidence

Because this task strengthens tests rather than changes production, demonstrate RED with temporary, uncommitted mutation probes. At minimum:

- corrupt one stored subtitle payload field and show the exact-payload assertion fails;
- suppress the retry of one rapid event (or corrupt one tracked ID/attempt count) and show the all-events recovery assertion fails;
- increment one artifact-path request count during a save and show the zero-synchronous-provider assertion fails;
- simulate a new page/dialog side effect and show the side-effect assertion fails.

Revert all probes before GREEN and commit. Record concise RED outputs in the handoff; do not commit mutation hooks.

## GREEN verification

```bash
pnpm exec eslint tests/e2e/extension/acquisition-save.spec.ts tests/e2e/extension/fixtures.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec playwright test tests/e2e/extension/acquisition-save.spec.ts --project=chromium-extension
git diff --check
git status --short
```

Use the integration worktree's dependency directory only through a temporary symlink if necessary; remove it before commit. Do not rerun DB, build, or unrelated suites.

## Upstream and license

- This is acceptance-test hardening only; do not change pinned YouTube Digest-derived production behavior.
- Do not copy LLM Wiki GPLv3 code, tests, prompts, components, or assets.

## Handoff

Commit only the allowed files. Return commit SHA, four RED mutation results, GREEN results, residual risks, and handoff path. Do not self-approve.
