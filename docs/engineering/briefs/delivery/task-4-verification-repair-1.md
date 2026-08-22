# Delivery Task 4 Verification Repair 1 — Restore the accepted unit gate

## Assignment

- Parent plan/task: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`, Delivery Task 4 final fresh-clone gate.
- Product baseline proving the regression predates Task 4: `f77abb35c58df6ab92d469aea547045b919525eb`.
- Repair baseline/HEAD: `6c20139b28c83f0820181c8b381a25cc6cff0e8a` plus Controller commits already on `/private/tmp/popcorn-delivery-4`.
- Worktree: `/private/tmp/popcorn-delivery-4`.

## Allowed files

- Modify `src/app/sign-in/sign-in-form.test.tsx`.
- Modify `src/features/saved/candidate-list.test.tsx`.
- Create `docs/engineering/handoffs/delivery/task-4-verification-repair-1.md`.
- This brief.

All runtime/application files, Task 4 acceptance/CI files, migrations, generated files, package manifests, lockfiles, and other tests are forbidden.

## RED evidence and diagnosis

The Controller ran the exact two focused tests both on accepted integration baseline `f77abb3` and on Task 4 HEAD. Both runs failed identically: 3 failures / 7 passes.

- `SignInForm` now intentionally exposes password sign-in and account creation. The stale test still queries the old `Email sign in` accessible form name and claims only email is posted.
- `SavedVideoPage` now consumes the already accepted `deletionPlanner.preview` interface. Two candidate-list page tests construct an incomplete runtime mock, causing a `preview` undefined exception before their intended assertions.

These are test-fixture drift repairs only. Do not change current product behavior or weaken assertions.

## Minimal GREEN

- Update the sign-in test name/query and assert the bounded password field plus the two explicit intent buttons while preserving fixed action, method, email bounds, and absence of arbitrary fields.
- Give the candidate-list page-test runtime a deterministic `deletionPlanner.preview` mock with the smallest accurate impact value needed by the current page. Assert the relevant delete-preview rendering if it is already part of the page contract; do not test or modify deletion behavior beyond satisfying the current accepted interface.
- Keep the two candidate-selection assertions unchanged.

## Verification

```bash
CI=true pnpm vitest run src/app/sign-in/sign-in-form.test.tsx src/features/saved/candidate-list.test.tsx
CI=true pnpm eslint src/app/sign-in/sign-in-form.test.tsx src/features/saved/candidate-list.test.tsx
git diff --check
```

Return implementation SHA, handoff SHA/path, tests, and risks. Do not integrate or push.

## Scope and licensing

- No upstream reuse is needed. Do not fetch/copy YouTube Digest or LLM Wiki content.
- MIT/GPL isolation and all runtime security/owner/queue contracts are unchanged.
