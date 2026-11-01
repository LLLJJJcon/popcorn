# Group 2 UI implementation report (Task 2C)

2026-11-01. Worktree: `/Users/liangjing/.codex/worktrees/phase1-groups2-4/进度`. This report records implementer self-tests. The separate acceptance agent still owns the Group 2 acceptance gate, SQL/backfill/integration/browser verification and every 5.17 final checkbox. No commit/push was made by this implementer.

Read: frozen `group-2-contracts.md`, Task2C of `docs/superpowers/plans/2026-11-01-phase1-groups2-4.md`, `preflight-phase1/group-2-practice.md`, confirmed specification section5/16.2, AGENTS.md and local Next16.3.1 page/server-client/route-handler guides. Followed RED→GREEN and verification-before-completion skills. User's latest override removes universal runtime fallback: this UI implements preparation error + retry with retained state and does not import, generate or expose templates.

## Files and responsibility

- `practice-material.tsx`: phase/round and Meaning here, interlocutor/setting label, Chinese/EN toggle, task-specific instruction, title/time external source link; About and examples split. No separate original-evidence disclosure.
- `practice-session.tsx`: server roundState restoration, local answer drafts, first/latest revision state, first-feedback disclosure, typed conflicts, new-round idempotency key reuse, remove/Undo and source return. Only server promotion receipts enable Vault success links.
- `api.ts`: generic validated success/failure envelopes and typed conflicts; first/revision bodies omit assistanceLevel; new rounds/remove/restore/examples consumers use the frozen schemas.
- `evaluation-panel.tsx`, new `answer-comparison.tsx`, `practice-controls.tsx`: exact character diff with Unicode code points, collapsed natural version, first/revision score arrows, lowest-dimension focus, all-five Nothing to fix without coaching/revision suggestion, local date formatting and reusable disclosure controls.
- New `return-target.ts`/tests and existing task page: await params/searchParams; whitelist Saved details/anchor, Practice with query, Vault UUID, Home; unsafe/missing values return to Saved. Task page keys the component by task ID.
- Saved `candidate-expression.tsx`, `candidate-list.tsx` and CSS: unpracticed / practicing Continue / removed Practice / promoted Vault detail; consume backend candidate.practiceState; activation accepts task or redirect; creation failure retains card and offers specified retry. Backend alone owns Saved data projection (`saved/api.ts` was not edited).
- Due component changes remain limited to this group's shared hints/examples persistence, removal of client assistance in completion body, and result copy. Existing three-item queue, local rewrite comparison and due generation remain unchanged; no expression masking, regeneration, review revision model call, session route or new queue implementation.

No shared contract/material-schema/server/SQL/generated types/pure prompt/seed/E2E file was modified by this UI task.

## Requirement self-check

| Specification | UI behavior and evidence |
| --- | --- |
| 5.4–5.5 | Removed obsolete Focused Mandarin/Current mastery for first practice, fixed generic goals and untracked evidence reveal. New label, Roundn, structured interlocutor/setting, EN toggle and task-specific instruction covered by first-practice test. After server promotion, header says In your Vault instead of contradicting the success result with Not in your Vault yet. |
| 5.6 | About shows How it fits/Tone & who/Watch out without request or assistance. Examples call the recording endpoint first; content remains hidden and submission disabled until success. Failure permits retry; saved marker restores on refresh. Missing card examples still shows original sentence after recording. Due uses its reviewTaskId endpoint. |
| 5.7 | `popcorn:answer:{taskId}` raw text, 500ms debounce and try/catch; delayed hydration does not overwrite typing, unsent revisions can also restore. Successful server result/conflict clears draft. English-only blocked; missing target expression only reminds. Eight-second waiting preserves request; gateway links Settings, provider retry resubmits retained text. |
| 5.8 | UI consumes three server dimensions and authoritative evaluation/roundState. It never derives independentUse or promotion from model-like output. Server scoring quality and semantic error behavior remain backend/acceptance responsibility. |
| 5.9 | Receipt-based Vault success, assisted-success and failed-dimension result lines; tomorrow copy for non-promotion; lowest focus with stable ties, all-five suppression. Natural version is collapsed, compares latest submitted text with exact character highlights, has no model call and no assistance side effect. |
| 5.10 | Revisions use firstAnswer.attemptId as backend explicitly confirmed; append indefinitely while correction is needed. Keep original answer/feedback, display latest revision and per-dimension score arrows. Passing revision gives Nice fix and new-round action; no false Vault claim or altered retry time. |
| 5.11 | Whitelist tested against external/scheme-relative/backslash/encoded-control/traversal/malformed UUID inputs; normal Saved anchor/Practice query/Vault/Home cases pass. Missing value returns to `/saved`. New-round navigation retains valid returnTo. |
| 5.12 | Initial roundState directly restores first/latest feedback and marker. FIRST_ANSWER_EXISTS renders its authoritative state and message. ALREADY_PROMOTED opens exact Vault detail. New-round network retry reuses its requestId. |
| 5.13 | Shared filled/outlined/tertiary/disclosure/segmented styles, minimum36px tertiary controls, visible affordances/icons, aria-expanded and rotated arrows; actions inside the feedback/response card, left-aligned, at most one primary per action row. No loose Vault link or duplicated first-practice Stop/Continue. |
| Group2 Due scope | Existing due tests still exercise sort/three-item cap/local comparison. About resets per item, examples are recorded before display, completion body has no assistanceLevel; new independent/assisted/fail result copy consumes server result and local dates. |

The UI does not manufacture missing translated situation or learning-card content for old tasks. Legacy fields remain readable. All new structured data comes from the frozen backend DTOs.

## Reusable component boundary for Group 3

`PracticeSession` supports `mode='session'`, `onNext`, `nextLabel='Next'|'Finish'`, `onCompleted(roundState)`, `onRoundCreated(taskId)` and an optional removal callback. These are injection points only: no session route/queue/count/storage-summary logic is implemented here. New-round callback allows the future runner to replace the task while retaining its candidate item identity. Current standalone removal waits for the server Undo deadline; the Group3 runner must own its immediate-advance/Undo presentation when integrating that behavior.

The practice return helper accepts `/practice` plus session query parameters. Future route changes must preserve that whitelist rather than admit arbitrary return URLs.

## RED → GREEN evidence

- `ui-red.log`: initial12 first-practice tests failed against old behavior; `ui-green.log` passed12/12 after implementation.
- `ui-red2.log`: missing Saved states/shared due behavior produced8 failures; subsequent changes restored all corresponding behaviors. Existing assertions for old hint-assistance/Practice recorded copy were updated to the confirmed new specification; sorting/cap/local-revision assertions remain.
- `ui-red3.log`:3 failures exposed missing preparation-error copy, incomplete unsent-revision restore and retry button that did not actually resubmit; `ui-green3.log` passed15/15 after fixing those causes.
- `ui-red4.log`: Saved preparation error still showed old generic text; its retained-card retry/redirect test now passes.
- `ui-diff-red.log`: long answers falsely marked1200 unchanged characters under a coarse fallback. Replaced that fallback with exact linear-memory LCS and passed the distant-insertion regression.
- `ui-final-red.log`:2 failures exposed stale Not in Vault yet after promotion and a revision action after passing revision; both fixed in accord with5.9.

Logs are under `/private/tmp/popcorn-phase1-test-stack/`. They contain fixture text only, no real user answers or keys.

## Fresh verification

Executed2026-11-01 06:52UTC using the already-installed worktree dependencies and `pnpm_config_verify_deps_before_run=false`:

| Command | Result |
| --- | --- |
| `./node_modules/.bin/vitest run src/features/practice src/features/saved` | **18 files,128 tests passed**, exit0 |
| `./node_modules/.bin/tsc --noEmit` | exit0, no diagnostics |
| `./node_modules/.bin/eslint src/features/practice src/features/saved/candidate-list.tsx src/features/saved/candidate-expression.tsx src/features/saved/candidate-practice-state.test.tsx src/features/saved/candidate-list.test.tsx 'src/app/(app)/practice/[taskId]/page.tsx'` | exit0, no diagnostics |
| `git diff --check` on owned UI paths | no whitespace errors |

Machine-readable exit evidence: `/private/tmp/popcorn-phase1-test-stack/ui-verification-results.json`; final logs `ui-verification-tests.log`, `ui-verification-types.log`, `ui-verification-lint.log`.

No final whole-project build/SQL/browser/semantic model acceptance is claimed by this UI report. Another agent will run those group gates after backend/prompt/seed integration stabilizes. No user confirmation is needed for the completed UI scope; no fallback content is waiting on UI approval.

## Final context-display correction (controller confirmed, 2026-11-01 07:14 UTC)

Visual inspection found that the pre-answer5.6 warning could contradict an already recorded/promotion result. The controller confirmed that the original warning is shown only while `roundState.firstAnswer` is absent. The implementation now gates that paragraph on exactly that field; the original English copy, About/examples buttons, model decisions, assistance, promotion, retry schedule and schemas are unchanged. A dedicated RED→GREEN regression covers visible before first answer and hidden after recorded answer/promotion, while both controls remain.

Fresh post-correction self-verification: combined practice/Saved/seed/cleanup **20 files,166 tests passed**, plus `tsc --noEmit` and targeted UI/demo/E2E eslint all exit0. Exact commands/exit codes are in `/private/tmp/popcorn-phase1-test-stack/ui-context-final-results.json`, with corresponding `ui-context-final-*.log`. The separate acceptance agent will rerun production E2E after backend integration. No additional backend/Saved aggregation edit was made by this implementer.
