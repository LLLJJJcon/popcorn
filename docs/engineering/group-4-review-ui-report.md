# Group 4 Review UI implementation record

2026-11-01. Owner C, isolated worktree `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`, branch `codex/phase1-group4-confirmed`. This is the scoped implementation/self-test record, not Group 4 acceptance. Controller and independent D own combined integration and acceptance.

## Preflight and scope

Read AGENTS.md, installed Next 16.3.1 server/client and router guides, confirmed specification §1/3/5.6–5.12/7/8.5/15/16.4, plan Group 4, Group 2/3 contracts, Group 3 Practice and independent acceptance reports. TDD and writing-good-tests instructions were read. Existing Group 3 acceptance is at `dabf1dc`, report `a117eaf`.

C owns only Review/client rendering paths: `review-practice.tsx`, `review-schema.ts`, `api.ts` or new `due-api.ts`, `practice-material.tsx`, `evaluation-panel.tsx`, `practice-controls.tsx`, `practice-workspace.module.css`, directly related UI tests and this report. No Home/Saved/Vault/Progress, contracts/server/routes/SQL/jobs/generated types/prompts, or Today runner/storage edits are authorized here. Shared props remain additive with unchanged first-practice defaults.

Old Review exposed the answer, used legacy generic task copy, had no reveal or regeneration actions, performed a local unscored fake rewrite, used a draft key without scenario identity, and could not restore official first/latest feedback on GET. These are the UI differences to replace after A freezes importable contracts. Legacy ready tasks retain their persisted wording; C does not invent missing intent/setting metadata or call a model to translate old tasks.

Four independently repaired Group 3 findings remain protected: finished-session exclusion lifetime, late item/task/sequence/alive response guards, external promotion fresh selection without a false Added result, and Review exact public `404/FORBIDDEN` or `409/CONFLICT` handling followed by a fresh owned-queue confirmation. The last guard remains in Review; the runner and storage are untouched.

## Initial RED → GREEN evidence

- `/private/tmp/group4-c-mask-red.log`: real Review leaked target through heading, meaning, About and source title; one new test failed while five baseline tests passed. The corresponding integration check now passes.
- `/private/tmp/group4-c-material-red.log`: four actual component masking/persist-before-reveal tests failed before implementation.
- `/private/tmp/group4-c-material-green.log`: `practice-material.test.tsx` and `practice-session.test.tsx`, **2 files / 26 tests passed** after additive masking props. Reveal and examples only display the target after their persistence callback succeeds; failure retains masking and retry. Every displayed material string is sanitized while hidden, including source title and old instructions.

All tests use fixture responses and the isolated `/private/tmp/popcorn-phase1-test-stack/with-test-stack.py` wrapper. No real model calls, personal database writes, personal app-port use, browser cleanup, commit or push was performed by C.

## Frozen integration and behavior

Consumed A's actual `src/contracts/review-practice.ts` and `group-4-contracts.md` only after schema publication. `review-schema.ts` is now a compatibility reexport. `due-api.ts` validates current HTTP envelopes, preserves exact public error status/code, and parses optional operation/current details. Historical callback Completion types remain compatible; current HTTP completion additionally requires authoritative `reviewState`. No official first answer or timestamp is reconstructed from local input.

- **Recall and hints:** current mastery and meaning remain visible; expression length is masked with one block per Unicode character. Hidden material sanitizes header/meaning, structured and old instructions, interlocutor, source title, all About fields and both languages. Original evidence stays closed. No target-bearing missing-expression reminder appears while hidden. Reveal and examples require the exact task/version/fingerprint and persisted timestamps before showing content. Reveal does not send assistance. Examples remain the unique `model_answer` path. Contradictory marker responses are rejected, and a response cannot erase markers already seen.
- **Question content:** modern material renders the existing bilingual situation, interlocutor, setting and `taskEn`. Ready legacy material retains its original persisted wording without added translation or inferred intent/setting. The UI never imports prompt/server modules or creates fallback content.
- **Preparation and retry:** initial entry uses plain GET. Existing server preparation IDs may be retained in optional session storage. GET202 polls the same operation; after eight seconds it displays exactly `Preparing a new situation…`. Network uncertainty retains its existing ID, or the same plain GET when no server ID is known. Reload reads the old cycle; it never creates a fresh UUID/model budget. Only explicit Try again after a typed terminal `failed` operation creates a new preparation ID. Every ID-bearing GET sends `X-Popcorn-Review-Retry: 1`. Gateway errors expose setup and an explicit retry, including return after a preclaim gateway failure.
- **Regeneration:** only the server's pre-submit `canRegenerate` enables Try a different situation. All conflicting writes/submission are disabled during a flight. Known in-progress responses repeat the same POST/body/ID after one second, not a GET of the old prepared question. Failure keeps question, input and allowance. Known terminal failure permits a deliberate new action ID; unknown failure reuses its ID. Success adopts the server's new identity and capability. A versioned draft is saved before replacement, and server markers must survive it.
- **Drafts:** keys are `popcorn:due-answer:{reviewId}:{taskId}:{version}:{fingerprint}`. Each new question restores only its own key. Unversioned old keys are left intact; they may restore only into an unanswered retained legacy version-one question, never a regenerated/modern question. Failed scoring and regeneration preserve text. Revision drafts and unknown operation IDs survive refresh when optional storage is available. A draft identical to a now-official answer opens authoritative feedback after a lost success response rather than creating a revision editor.
- **Completion and revisions:** official result copy and local date derive from the original server first-answer receipt/evaluation. Actual new201 and same-answer replay validate the complete official state and emit at most one completion callback. GET restore, marker-driven restoration and revisions never call `onCompleted`. Real revisions post the official first attempt ID plus exact question identity and stable action ID, render first/revision text and score arrows, retain First feedback, and keep the official result line/schedule unchanged. Revisions are unlimited. Show a natural version uses the existing character diff and makes no request; all-five feedback hides it.
- **Navigation and races:** standalone primary return is Back to Today's practice; embedded Review retains Next/Finish and heading level2 with one page main/h1. No Today runner/storage, Exit geometry or PracticeSession behavior was rewritten. Original status+code queue-confirmation handling remains; provider/still-eligible conflicts retain input, actual same-answer201 remains a completion, and obsolete/unmounted responses cannot update another item. A typed scenario conflict adopts the owned current question in place, saves the old draft and removes the stale scoring retry; foreign/inconsistent current data is rejected without losing the original draft.

## Additional RED → GREEN record

Each file below captured an observed failing real component behavior before its corresponding fix. Later focused logs include all these tests passing.

| RED log | Break reproduced and fixed |
| --- | --- |
| `group4-c-review-contract-red.log` | Missing frozen Review identity/regen/restore/preparing integration |
| `group4-c-retry-red.log` | Unstable initial request handling, current-only conflict handling and missing gateway retry |
| `group4-c-no-refresh-cycle-red.log` | A fresh mount could send a new UUID and reopen a known failed model cycle; now reload reads only the existing cycle |
| `group4-c-revision-recovery-red.log` | Missing retry header and revision draft lost before the debounce during an uncertain submission |
| `group4-c-marker-draft-red.log` | Opening examples discarded an unsent revision; contradictory task text could be displayed |
| `group4-c-official-state-red.log` | Missing HTTP state was rebuilt locally; a now-official draft reopened revision rather than feedback |
| `group4-c-conflict-identity-red.log` | Foreign conflict current data escaped as an unhandled rejection |
| `group4-c-markers-authority-red.log` | A success envelope without persisted markers disclosed content; regeneration could erase already-seen markers |
| `group4-c-old-draft-red.log` | Retained legacy version-one draft did not restore after the key migration |

Logs are fixture-only under `/private/tmp/`. An early permission denial changed no file; scoped authorized worktree write escalation was subsequently approved. A fixture-return edit initially matched the wrong helper and was corrected before the full Practice rerun; no production state-machine assertion was removed or weakened.

## Self-verification

At18:16 local workspace test time, `vitest run src/features/practice tests/integration/memory/vault-practice.test.ts` passed **14 files /149 tests** (`/private/tmp/group4-c-focused-final.log`). Owned Practice ESLint and `git diff --check` both exited0. Tests include the four retained Group3 findings with real components and public envelopes, plus real revision requests, no second completion, mask/marker failures, generation recovery/ID lifecycle, revision refresh and first/latest feedback.

Earlier whole-project execution reached source **75 files /694 tests passed**. Its contract stage passed230/231, stopping on A's newly added API error codes versus the stale exact taxonomy assertion in `tests/contract/shared-contracts.test.ts:1091`; A was notified and repaired it. Independently executed remaining stages passed integration **30 files /562 tests**, prompt fixtures **4 files /63 tests**, and provenance **2 files /16 tests**. That interrupted run is not represented as one passing chained run.

Whole-project lint exited0 with four existing warnings outside C's files: unused `_status` in `scripts/process-local-jobs.mjs`, unused `SavedItemAnalysisContentSchema` in `tests/integration/jobs/process-jobs.test.ts`, and `_userId`/`_savedItemId` in `tests/integration/knowledge/source-traceability.test.ts`. C's files have no warning/error. During concurrent A implementation, whole-project typechecks successively found A-owned generic mock/header fixture errors; those were reported to A and repaired before the final direct typecheck.

Final verification against C's final production source:

| Command | Observed result |
| --- | --- |
| Isolated-wrapper `pnpm test`,18:17–18:18 | **119 files /1595 tests passed**: source76/739, contract9/231, integration30/562, prompt4/63; complete chained run (`group4-c-final-project-test.log`) |
| Focused Practice + Vault integration | **14 files /149 tests passed** (`group4-c-focused-final.log`) |
| `tsc --noEmit`, direct final execution | **exit0, no diagnostics**; no client or project type error remains at this checkpoint |
| Whole-project ESLint | **exit0**, four existing warnings listed above (`group4-c-final-lint.log`) |
| Owned Practice ESLint | **exit0, no warnings/errors** (`group4-c-lint.log`) |
| Provenance fixture suite | **2 files /16 tests passed** (`group4-c-provenance.log`) |
| `git diff --check` on owned paths | **exit0** |

The final full test checkpoint includes concurrently published A/B source present at that moment; it does not claim later backend edits or SQL/browser integration have been verified. Controller retains ownership of the final production build and reserved browser suites after integration freezes.

## Scope and remaining gate

Production edits: ReviewPractice, Review schema reexport, new due-api, additive PracticeMaterial props. Existing EvaluationPanel/AnswerComparison/controls/CSS/API/PracticeSession/Today runner/storage were reused without production edits. Test edits: Review/Due tests, new shared-material tests and test-only Review envelope helpers, plus the existing Today DOM/concurrency fixture envelopes and specified Review labels/masked headings. Vault integration was run without edits.

Specified copy changes: Your Chinese response → Your answer in Chinese; Check my response → Check my answer; Compare with suggested revision/Show comparison → real Revise this answer/Check my revision; old generic slow copy → exact Preparing a new situation… for preparation/regeneration. Existing four §7.4 result lines and local date behavior remain. Added notices explain authoritative situation/previous-answer conflicts. No product fallback, extra model call, mastery/scheduling/independence rule, dependency, temperature, real-content claim, commit or push was introduced.

C does not claim server/SQL/job integration, browser E2E, seed completeness, missing-legacy-metadata product policy, three-intent real generation or the20-question human semantic gate. Controller/A/B and independent D own those remaining combined gates. Fixture success is engineering evidence only.
