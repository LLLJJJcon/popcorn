# Delivery Task 4 verification repair 1 handoff

## Result

- Implementation commit: `5cec1c7f9b2beec255e7022c352545201a32b1b4`
- Brief commit: `2233e911962d71ef1acfa25d60364e8f19e54753`
- Worktree/branch: `/private/tmp/popcorn-delivery-4`, `codex/popcorn-delivery-4`
- No integration or push was performed.

## RED evidence and root cause

The Controller reproduced the same focused result on both accepted product
baseline `f77abb35c58df6ab92d469aea547045b919525eb` and Task 4 HEAD: 3 failed / 7
passed.

- `SignInForm` had intentionally advanced to bounded password authentication
  with explicit `sign-in` and `sign-up` intents, while its stale test still
  queried the old email-only form contract.
- Two `SavedVideoPage` cases used a partial runtime mock that omitted the
  already accepted `deletionPlanner.preview` interface, so they threw before
  reaching their candidate-selection assertions.

The identical baseline/HEAD failure proves this was pre-existing test-fixture
drift rather than a Task 4 runtime regression.

## Changes

- `src/app/sign-in/sign-in-form.test.tsx`
  - Queries the current accessible form name.
  - Preserves fixed POST action, email bounds, exact input count, and the guard
    against arbitrary redirect/callback/token fields.
  - Asserts the bounded password and both exact submit intent controls.
- `src/features/saved/candidate-list.test.tsx`
  - Adds the smallest complete `deletionPlanner.preview` mock matching the
    current page fixture.
  - Resets the new mock per test.
  - Confirms the accepted delete-preview heading renders.
  - Leaves all prior candidate selection, artifact-version, and payload
    assertions unchanged.

No runtime, Task 4 acceptance/CI, migration, generated, manifest, lockfile, or
other test file changed.

## GREEN evidence

- `CI=true pnpm vitest run src/app/sign-in/sign-in-form.test.tsx src/features/saved/candidate-list.test.tsx`: 2 files passed, 10/10 tests passed.
- `CI=true pnpm eslint src/app/sign-in/sign-in-form.test.tsx src/features/saved/candidate-list.test.tsx`: exit 0.
- `git diff --check`: exit 0.
- Independent read-only review: no Critical, Important, or Minor findings;
  ready.

## Risks and licensing

- The page test intentionally mirrors the complete current `DeletionImpact`
  shape. A future deliberate interface change must update this fixture along
  with the page contract.
- This repair changes no application behavior and does not broaden deletion,
  authentication, owner, queue, or network behavior.
- No upstream content was fetched or copied. MIT/GPL isolation, YouTube Digest
  provenance, and LLM Wiki method-only isolation are unchanged.
