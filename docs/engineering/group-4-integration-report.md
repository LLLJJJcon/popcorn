# Group 4 controller integration record

2026-11-01. Worktree `phase1-groups2-4/进度`, branch `codex/phase1-group4-confirmed`. This records implementation checks; separate D final acceptance and product decisions remain pending.

## Ownership and serial gates

Groups1–3 were independently accepted and merged before group4. A owns persistence, repositories, API/runtime and jobs. B owns pure generation/direction and the separate revision/completion coordinators; B's SQL regression files exercise A's actual functions. C owns Review UI. Controller owns demo fixtures, browser integration and GitHub checkpoints. D implements none of these and owns final acceptance. A's shared contracts precede parallel UI/domain work; actual HTTP/storage integration precedes browser acceptance; all engineering and required product gates precede merge.

The durable database checkpoint is4a8d400. Additive032–036 and four new SQL files pass152 assertions on the dedicated54332 database. Applied migrations are immutable; subsequent repairs append new migrations. Final completion request-cost claims, outbox/worker wiring and integrated endpoints are still being completed, so this checkpoint is not engineering acceptance.

## Demo preparation

New synthetic canonical senses have explicitly authored modern cards in `tests/fixtures/demo/review-fixtures.ts`: 挺靠谱的/Praise, 慢慢来/Suggest and 太离谱了/Complain. Existing rows use insert-only seeding: old missing metadata and learner edits are preserved. This is classroom fixture authoring, not a production semantic recovery map.

`seed-demo.ts` plans two prepared examples: near/Praise/Casual chat for tried, far/Suggest/Work & school for reused. It uses actual `read_review_practice_context`, `claim_review_preparation` and `publish_review_scenario` with `fixture/demo-transfer-scenario-v1` provenance and no model call. It preserves any already prepared question, completed review or incomplete legacy card. The fresh examples start at version1 with no disclosure or regeneration consumed; the normal Review UI masks them. No withdrawn generic template is installed. Existing legacy/demo histories and mastery/scheduling remain unchanged.

Self-test: new-card schema test first failed, then passed; prepared-example plan test first failed, then passed. All34 seed tests pass, including owner scoping, repeated seeding, unchanged mastery/schedule/edited marks and explicitly edited card metadata. Scoped ESLint and whole TypeScript checks pass at this integration point.

Actual isolated seed: reserved owner `56000000-0000-4000-8000-000000000001`, exact email `group4-demo-isolated@popcorn.test`. Private driver `/private/tmp/popcorn-phase1-test-stack/group4-demo.mts` ran through the validated54331/54332 wrapper. It created two real-published modern tasks and two archive rows, checked exact near/far intent/setting, version1, unused allowance, legal unique fingerprints and no target leakage. A second seed with reference day+1 left every stored row in all15 established demo tables and both archive rows byte-identical. Queue remained2 reviews /1 second try /3 new /12 minutes, ordered Review→Second→New. Stored15-table snapshot SHA256: `11e1817daa0ddefff68ddce75dbac1c1541c15803b5d6201fdb6a1df68c19452`. No personal database or real model was used.

## Browser changes awaiting integrated execution

Both required browser suites are updated. The returning learner covers initial masking, a dropped regeneration request retaining old question/draft/allowance, retrying the same request ID, one successful replacement and refresh, reveal-only independent completion, completed refresh, examples after completion, scored learning revision, unchanged official graph and original completion replay. The dropped-request case is browser/network recovery evidence; actual provider failure and publication races belong to the domain/SQL suites.

The saved-learning loop retains real multi-round promotion and adds masked/revealed/examples-assisted Review. The six-item mixed session retains Exit/resume, refresh, new round staying in place, Remove/Undo, finish/summary and empty states, using the updated real demo seed. Cleanup remains guarded by exact reserved owner/email and selected local API/database port, now also deleting new review operation/revision/archive rows before their referenced graph. Browser files lint and Playwright discovers5 cases. **They have not yet passed against the completed group4 endpoints.**

## Open gates

- A/B finish completion idempotency, source-free official receipt replay, worker/outbox and full cross-layer checks; controller runs browser integration; D then accepts a frozen commit independently.
- Missing legacy metadata remains the unapproved product choice in `group-4-legacy-decision.md`; no extra legacy-generation prompt is implemented.
- Actual20 modern questions were generated once by D and preserved at9a7aa6a. Structural20/20 is not human semantic approval; the product review file remains unfilled pending the user's decision.
- User cancellation of generic fallback supersedes the original template portions of7.2/8.7/15.1. Cold failure offers retry with state retained; failed replacement retains the old question and allowance. No expression-specific bank is added.
