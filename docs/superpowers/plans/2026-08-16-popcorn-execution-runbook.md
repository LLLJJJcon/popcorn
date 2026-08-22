# Popcorn YouTube Learning Execution Runbook

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this runbook one task at a time. Use `superpowers:test-driven-development` for implementation tasks and `superpowers:verification-before-completion` before every completion claim.

**Goal:** Execute the approved Chrome-extension-plus-web Popcorn plan without relying on chat memory, regenerating available upstream code, widening the first release, or interrupting YouTube playback during saves.

**Architecture:** A Chrome extension adapts the pinned YouTube Digest acquisition and Side Panel experience for Chinese source videos and sends small, idempotent saves to the Popcorn backend. The web app stores revisioned learning-material snapshots, performs durable knowledge jobs, applies adapted LLM Wiki organization methods, and supports confirmation, reuse, practice, lexical retrieval, and basic progress.

**Tech Stack:** TypeScript, Chrome Manifest V3, React/Vite extension UI, Next.js web app, Supabase Postgres/Auth/RLS/Cron, Zod, Vitest, Playwright, `pg_trgm`, server-side LLM and transcript providers.

---

## 1. Canonical inputs and conflict order

Read these files completely before implementation:

1. `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md`
2. `docs/superpowers/specs/2026-08-22-popcorn-local-first-school-demo-design.md`
3. `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`
4. `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`
5. `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`
6. `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`
7. `docs/superpowers/plans/2026-08-16-popcorn-delivery-demo.md`
8. `docs/superpowers/plans/2026-08-22-popcorn-local-first-amendments.md`
9. `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`
10. `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
11. `docs/superpowers/plans/2026-08-16-popcorn-agent-orchestration.md`
12. This runbook.

Resolve conflicts in this order:

1. The user's latest explicit instruction.
2. The approved 2026-08-22 local-first design addendum.
3. The original product design.
4. The task's approved 2026-08-22 overlay plan, then its original module plan.
5. The orchestration plan and this runbook.
6. An implementer's interpretation.

If levels 1–3 disagree, stop and present the exact conflict. Do not silently choose.

## 2. Frozen first-release boundary

The release has one acquisition source: the currently watched YouTube video. The product remains Popcorn: English-speaking learners acquire and reuse Mandarin from native-Chinese videos.

The save operation stores a **learning-material snapshot**, never the video file. A snapshot can contain:

- stable video identity and display metadata;
- native Chinese transcript lines and timestamps;
- overview, chapters, and key quotes;
- English translations that already exist when the user saves;
- a player moment, subtitle line or selection, quote, or AI explanation;
- source locators and a snapshot revision.

Saving is background work. It must not pause playback, navigate the tab, open the web app, wait for AI generation, or require a modal. A brief acknowledgement is allowed. The user reviews saved content later on the Popcorn website.

The first release excludes generic URL, pasted text, image, screenshot, document, and audio inputs; video-file storage; `pgvector`; semantic/vector retrieval; chat-with-library; advanced analytics; export; social features; and additional mastery states. Those are post-product add-ons.

`saved` is a storage condition, not mastery. The only mastery states are:

```text
tried -> reused -> owned
```

## 3. Mandatory upstream reuse ledger

Every implementation brief must name an upstream repository, immutable ref, source path, symbol or behavior, and action: `reuse`, `adapt`, or `method only`. “Inspired by” is not sufficient.

### 3.1 YouTube acquisition and watching experience

- Repository: `https://github.com/zarazhangrui/youtube-digest.git`
- Immutable ref: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`
- License: MIT; preserve required copyright and license notices for copied/adapted code.
- Intake location: `vendor/youtube-digest/`
- Allowed import is restricted by the allowlist and provenance test defined in Foundation Task 1.

Required reuse targets are already enumerated in Batch A. At minimum, briefs must point to the pinned implementations for:

- YouTube video identity and watch-page lifecycle;
- background transcript fetch/poll behavior;
- Side Panel application and transcript navigation;
- transcript row interaction and time seeking;
- overview, chapters, quotes, and translation rendering;
- keyboard/player save-adjacent behavior that is being adapted;
- extension build and packaging scripts.

Do not rebuild these behaviors from a blank component when an allowed upstream implementation exists. Adapt source Chinese to English translation, Popcorn auth, server-owned providers, and background cloud save.

### 3.2 Knowledge organization and review

- Repository: `https://github.com/nashsu/llm_wiki.git`
- Release: `v0.6.9`
- Immutable ref: `723e259309aea5e3850265b631f80224f66dd9f6`
- License: GPLv3.
- Use mode: **method only**. Do not copy, translate, or derive implementation code, tests, prompts, UI components, or assets into Popcorn.

Adapt only the plan-documented ideas: raw source to structured knowledge to learning evidence, source traceability, staged analysis, durable jobs, and lexical retrieval. Popcorn independently implements these ideas for video snapshots and expression learning. Retrieval and spaced practice remain separate subsystems.

### 3.3 Provenance stop condition

Before implementing a task that touches acquisition, Side Panel UX, transcript behavior, or knowledge processing:

1. Search the pinned upstream tree using the exact path/symbol listed in the task plan.
2. Record the source path, ref, license mode, and planned adaptation in the task handoff.
3. If a referenced path or symbol is absent at the pinned ref, stop that task and report the mismatch.
4. If the desired file is outside the YouTube Digest allowlist, request a deliberate allowlist change with license review.
5. If proposed LLM Wiki reuse would copy GPL-covered expression, stop and implement the documented method independently.

## 4. Copy-paste instruction for the implementation controller

```text
Execute the approved Popcorn YouTube learning plans in this repository.

Read both product design documents, all original module plans, all three 2026-08-22 overlay plans, the agent orchestration plan, and the execution runbook in full. Use superpowers:using-git-worktrees before implementation, superpowers:subagent-driven-development to execute tasks, superpowers:test-driven-development for every feature or fix, superpowers:requesting-code-review at integration gates, and superpowers:verification-before-completion before completion claims.

Do not work directly on main. Begin with a read-only preflight and create an isolated feature worktree. Execute Foundation Tasks 1–5 sequentially. Then follow the exact dependency schedule in the orchestration plan. Shared contracts, migrations, root configuration, lockfiles, and integration routes remain controller-owned.

For every task, create a durable brief that includes exact upstream repository, immutable ref, source path, function/component/behavior, and reuse mode. Reuse or adapt allowed YouTube Digest code instead of regenerating it. Use LLM Wiki v0.6.9 only as a method reference and never copy GPLv3 code, tests, prompts, UI, or assets.

Keep the first release restricted to the currently watched YouTube video. Save learning-material snapshots in the background from video, player moment, subtitle row/selection, key quote, and AI explanation. Do not pause playback, open the web app, call providers in the save request, or store the video file. Keep mastery exactly tried -> reused -> owned. Do not add pgvector or deferred inputs.

Use one fresh implementation context per numbered task when delegation is available. Require RED/GREEN test evidence, a commit, a handoff report, and review before integration. Update the execution ledger after each accepted task. Resume from Git, the ledger, checkpoints, and handoffs rather than conversation history. Treat local Next.js + local Supabase + the generated unpacked extension as the sole required release topology. Continue until its acceptance suite and one real local Provider smoke pass, or an external credential/service or genuine specification conflict blocks progress.
```

## 5. Read-only preflight

Run from the repository root:

```bash
git status --short
git branch --show-current
git log -5 --oneline
git worktree list
rg --files -g 'AGENTS.md' -g 'package.json' -g 'pnpm-lock.yaml' -g 'supabase/**' -g 'apps/**'
```

Then:

1. Read every applicable `AGENTS.md`.
2. Record existing user changes; never overwrite or absorb unrelated work.
3. Confirm both immutable upstream refs in the plans.
4. Confirm the product and plan files agree on save kinds, job kinds, mastery states, and exclusions.
5. Report all real conflicts in one batch. If none exist, create the feature worktree.

Use `superpowers:using-git-worktrees`. If manual worktrees are required, verify that `.worktrees/` is ignored before creating one. Use a `codex/`-prefixed branch unless the user gives a different branch name.

## 6. Durable execution state

Chat is not the system of record. Before Foundation Task 1, create `docs/engineering/execution-ledger.md` with real values:

```markdown
# Popcorn Execution Ledger

## Current position
- Stage: foundation
- Next task: Foundation Task 1
- Integration branch: codex/popcorn-youtube-learning
- Last verified commit: <actual SHA>

## Completed tasks
| Plan | Task | Branch | Base | Head | Review | Verification |
|---|---:|---|---|---|---|---|

## Open concerns
| ID | Severity | Owner | Description | Required action |
|---|---|---|---|---|

## Contract changes
| ID | Requested by | Decision | Contract commit | Consumers notified |
|---|---|---|---|---|
```

Replace `<actual SHA>` before committing. After each accepted task, append its actual base, head, review result, and verification command.

Each numbered task writes and commits:

```text
docs/engineering/handoffs/<plan-slug>/task-<number>.md
```

Use this exact report structure:

```markdown
# Task Handoff
- Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- Plan and task:
- Worktree and branch:
- Baseline SHA:
- Commit SHA:

## Implemented
## Upstream provenance used
## Interfaces consumed and produced
## Files changed
## TDD evidence
### RED
### GREEN
## Broader verification
## Contract or migration changes requested
## Risks and follow-up
```

Never put secrets, raw user data, provider credentials, full provider responses, or copied chat history in the ledger or handoff.

At each integration gate create one checkpoint:

- `docs/engineering/checkpoints/foundation.md`
- `docs/engineering/checkpoints/gate-a.md`
- `docs/engineering/checkpoints/gate-b.md`
- `docs/engineering/checkpoints/gate-c.md`
- `docs/engineering/checkpoints/release.md`

Each checkpoint records real SHAs, integration order, conflicts, contract decisions, commands, results, and the next permitted stage.

## 7. Task brief contract

Every task brief must contain:

- plan file and task number;
- baseline commit and worktree;
- exact allowed and forbidden paths;
- interfaces consumed and produced;
- exact test commands and expected first failure;
- upstream repository and immutable ref;
- exact source file plus function/component/behavior;
- action: `reuse`, `adapt`, or `method only`;
- license treatment;
- acceptance criteria and exclusions.

The implementer prompt must say:

```text
Implement exactly this numbered task in the assigned worktree. Read the complete brief first. Ask before editing if the brief conflicts with frozen contracts or the pinned upstream source. Follow TDD and capture actual RED and GREEN output. Do not edit shared contracts, migrations, lockfiles, root configuration, or another stream's files unless the brief explicitly assigns them. Do not regenerate an allowed YouTube Digest behavior. Do not copy GPLv3 LLM Wiki expression. Commit the implementation and handoff, then return status, commit SHA, test summary, concerns, and handoff path.
```

## 8. Exact execution schedule

The authoritative task counts are:

- Foundation: Tasks 1–5.
- Batch A: Tasks 1–7.
- Batch B: Tasks 1–6.
- Batch C: Tasks 1–6.
- Delivery: Tasks 1–6.

For remaining work, the 2026-08-22 overlays replace conflicting uncompleted
steps in the original Batch C and Delivery plans.

### Foundation

Run Tasks 1–5 sequentially. Freeze contracts only after all foundation tests, provenance checks, migrations, RLS tests, and CI pass.

### Batch A

After the foundation checkpoint:

- Task 1 establishes extension linking.
- Tasks 2 and 3 may proceed concurrently after Task 1 if they edit disjoint files.
- Task 4 follows frozen server contracts and may run alongside Task 3.
- Task 5 requires Tasks 3 and 4.
- Task 6 requires Task 4 and owns the durable queue.
- Task 7 runs only after Tasks 1–6 pass review.

Gate A must prove authenticated link, native-Chinese acquisition, reused/adapted Side Panel UX, all save entry points, idempotency, queue survival across service-worker restart, and no playback interruption.

### Batch B

After Gate A:

- Tasks 1 and 2 may proceed concurrently on disjoint job-processing and library UI paths.
- Task 4 may proceed in the same wave against frozen confirmed-candidate fixtures because its practice files do not overlap Tasks 1–2.
- Task 3 requires candidate output from Task 1 and source display from Task 2.
- Task 5 requires Task 4 and owns atomic card/mastery/practice creation.
- Task 5 also requires Task 3 so the integrated transaction uses real selected-candidate evidence rather than fixtures.
- Task 6 is the sequential integration gate.

Gate B must prove snapshot to knowledge candidate to learner reuse to due practice, with source traceability throughout.

### Batch C

After Gate B:

- Task 1 is accepted.
- Primary executes Local-First Task 1; a feature agent may repair Batch C Task 3
  concurrently because file ownership does not overlap.
- Batch C Task 2 waits for Local-First Task 1 and the final user-configured
  gateway interface.
- Local-First Tasks 2-4 run in order; Tasks 3-4 may not overlap extension files.
- Batch C Task 4 waits for Tasks 2 and 3 and implements source deletion only.
- Batch C Task 5 waits for Task 4 and Local-First Task 4.
- Primary executes Task 6 as one returning-learner integration gate.

Gate C must prove lexical Chinese retrieval, three-state evidence advancement, basic progress, deletion isolation, retry/recovery behavior, and keyboard/accessibility behavior.

### Delivery

Run revised GitHub Delivery Tasks 1–6 sequentially. There is no required cloud
deployment. Complete packaging/license audit, deterministic demo data, the
fresh-clone guide, and fixture acceptance before one real local YouTube/model
smoke. Only after those pass may the primary integrate to GitHub main and tag
the demo release. Real-service verification must never expose credentials.

## 9. Review and integration gate

For each task:

1. Read the handoff and verify the commit exists.
2. Diff from the recorded baseline, not `HEAD~1`.
3. Confirm changed paths match ownership.
4. Confirm the provenance section names exact upstream paths and actions.
5. Re-run the focused tests and only the broader command explicitly required by
   the authoritative overlay task; do not invent a full-suite gate.
6. Review specification compliance before code quality.
7. Send Critical or Important findings back for a tested fix.
8. Re-review the complete baseline-to-head diff.
9. Integrate only after both reviews pass.
10. Update and commit the ledger and applicable checkpoint.

A controller-owned contract change pauses all consumers. Add or update contract tests, commit the shared change, record the new baseline, rebase affected streams, rerun their focused tests, regenerate stale briefs, and resume only when all consumers name the same contract commit.

## 10. Risk controls

### Upstream regeneration

The provenance allowlist test fails if acquisition/UI code appears without a source mapping. Reviewers compare new behavior with the pinned YouTube Digest implementation and reject blank rewrites.

### GPL contamination

No LLM Wiki code, tests, prompts, UI, naming-specific structure, or assets enter the tree. Handoffs cite only the method being independently implemented. The delivery license audit searches for copied headers and unexpected source similarity.

### Manifest V3 service-worker lifetime

Never rely on module globals, long timers, or one uninterrupted worker lifetime. Persist queue entries and retry metadata in `chrome.storage.local`, keep payloads bounded under the planned quota, and test worker termination/restart between enqueue and delivery.

### Save-path latency

Save endpoints validate, persist, enqueue, and return. They do not fetch transcripts, translate, summarize, or call an LLM/provider synchronously. Generated content already visible in the extension may be included in the snapshot.

### Idempotency and revision drift

Every client event has `clientEventId`; the database uniqueness rule uses the authenticated user and client event. Repeated delivery returns the same logical result. A new snapshot revision is created only when content materially changes; saved items retain their source revision.

### Wrong-account queue replay

Queue entries include the Popcorn user identity that created them. On unlink, logout, or account switch, do not send one user's queued content as another user. Keep it quarantined for the original account or allow explicit local discard.

### Native-language fallback

Providers may return another language when Chinese is unavailable. Validate the actual transcript language and show a recoverable unsupported/no-Chinese state instead of silently saving a wrong-language transcript.

### Deletion and jobs

Source deletion removes the owner's raw source identity/content/locators. For a
practiced source it retains tombstoned canonical learning, attempts, mastery,
reviews, and immutable replay IDs exactly as CONTRACT-016 specifies, without
touching another user's data. Pending/running jobs re-check source ownership
before writing and end safely when the source was deleted.

### Secrets and external state

Provider and service keys stay server-side and out of logs, fixtures, extension storage, handoffs, and commits. Missing production credentials or provider access can block real-service verification, but cannot justify weakening local fixture tests.

The public Supabase anon key may appear in generated extension configuration.
`SUPADATA_API_KEY` remains a separate server-only prerequisite. The user's model
gateway key is entered only in authenticated Web settings and resolved only by
the owner-bound worker. Global `OPENAI_API_KEY` and `OPENAI_MODEL` are retired.

### Proportionate verification

Use focused RED/GREEN commands and the independent reviewer for every task.
Repeat full pgTAP, concurrency, full application, build, or browser suites only
when the task changes the boundary they prove. Run one Batch C candidate build
and one final clean-checkout release gate. Do not add load, quota, SLO,
multi-environment, WAF, backup-drill, or commercial compliance gates.

## 11. Verification commands by gate

The command lists in the 2026-08-22 overlay plans are authoritative for the
remaining local-first, Batch C, and Delivery gates. Previously recorded broad
gates remain evidence and are not repeated solely for ceremony.

Use exactly the commands declared by the authoritative overlay task. A typical
feature task runs its RED/GREEN tests, scoped lint where declared, TypeScript,
and `git diff --check`; it does not automatically run full lint/test/E2E/build.
Migration/shared-contract/auth-secret/queue tasks run their named broader
boundary gate. Batch C runs its one candidate build, and Delivery runs the one
final broad clean-checkout gate. Record exit codes and concise output in
checkpoints. A skipped command that the overlay explicitly requires is not a
pass; record it as blocked with the missing dependency.

## 12. Resume protocol

After interruption, execute:

```text
Resume the Popcorn YouTube learning implementation from durable state. Read the execution runbook, execution ledger, latest checkpoint, Git history, and worktree list. Verify every recorded head SHA exists. Treat only reviewed ledger rows as complete. Resume at the first unreviewed task. Do not repeat accepted work. If Git, ledger, or checkpoint state disagree, report the exact mismatch before editing.
```

Then inspect:

```bash
git status --short
git log --oneline --decorate --all -20
git worktree list
```

The valid stop conditions are: the full release acceptance suite and real-service release checks pass; an external credential/service dependency blocks the next scoped step; or a genuine specification conflict requires the user. Difficulty, context compaction, or an idle worker is not a completion condition.
