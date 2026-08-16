# Popcorn YouTube Extension and Web Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate implementation of the pinned YouTube Digest adaptation, cloud capture, saved knowledge, learning loop, retrieval, resilience, and delivery through contract-first gates.

**Architecture:** Foundation and shared migrations execute sequentially. Later agents receive frozen interfaces and non-overlapping file ownership; the primary agent alone integrates cross-module transactions, upstream provenance, service-role workers, migrations, and full browser gates.

**Tech Stack:** Next.js, Supabase, Chrome Manifest V3, pinned YouTube Digest JavaScript, server provider adapters, Vitest, Playwright persistent Chromium.

## Global Constraints

- Canonical spec: `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md` at commit `ec5785e` or its reviewed successor.
- Plan execution order: Foundation -> Batch A -> Gate A -> Batch B -> Gate B -> Batch C -> Gate C -> Delivery.
- Only the primary agent modifies contracts, root configuration, migrations, generated database types, vendor scripts, upstream notices, or integration-ledger state.
- Feature agents may not regenerate upstream YouTube Digest functionality when a named pinned function exists.
- `nashsu/llm_wiki` is method-only provenance; copying GPLv3 implementation code is a blocking review failure.
- At most three implementation agents run concurrently; the primary retains one coordination/review slot.
- Every task follows red test -> minimal implementation -> green focused tests -> reviewer gate -> commit.
- A reported success without command output, changed-file list, upstream-reuse record, and unresolved risks is incomplete.

## Plan Set

| Order | File | Deliverable |
|---|---|---|
| 1 | `2026-08-16-popcorn-foundation-contracts.md` | pinned intake, contracts, schema, RLS, jobs, mastery, CI |
| 2 | `2026-08-16-popcorn-batch-a-platform-capabilities.md` | extension linking, native Chinese transcript, exact capture, offline sync |
| 3 | `2026-08-16-popcorn-batch-b-learning-loop.md` | job processing, Saved, candidate knowledge, Use It Now, Vault, Practice |
| 4 | `2026-08-16-popcorn-batch-c-progress-chinese.md` | retrieval, reuse mastery, Progress, deletion, resilience |
| 5 | `2026-08-16-popcorn-delivery-demo.md` | packaging, seed, operations, deployment, acceptance, release evidence |

## Dependency Graph

```text
Foundation Tasks 1-5 (sequential)
        |
        v
Batch A
  A1 auth/link ---> A2 transcript provider ---> A3 Side Panel adaptation
        |
        +----------> A4 cloud capture
                          |
             A5 exact save UI + A6 durable sync queue
                          |
                    A7 integration gate
        |
        v
Batch B
  B1 job processor ---- B2 Saved library ---- B3 candidate confirmation
                                                    |
  B4 Use It Now (frozen fixtures) ------------------+
                                                    |
                                  B5 Vault/Practice transaction
                                                    |
                                      B6 integration gate
        |
        v
Batch C
  C1 retrieval     C2 due mastery     C3 Progress
        \              |              /
         +-------- C4 deletion ------+
                      |
                C5 resilience
                      |
                C6 integration gate
        |
        v
Delivery Tasks 1-6 (sequential environment ownership)
```

## Foundation Schedule

- [ ] **F1:** Primary scaffolds web, vendors the pinned YouTube Digest allowlist, and freezes MIT/GPL provenance.
- [ ] **F2:** Primary freezes API/source/knowledge/practice/memory contracts.
- [ ] **F3:** Primary creates schema, indexes, RLS, seed, and generated types.
- [ ] **F4:** Primary implements pure mastery, scheduling, and job lease rules.
- [ ] **F5:** Primary adds Cron hook, CI, ownership, and upstream policy.
- [ ] **Foundation gate:** Run every command in the Foundation Exit Gate and record exact output.

No feature agent starts before Foundation passes. A required contract change after freeze is submitted as a proposal; only the primary edits and re-runs the complete foundation gate.

## Batch A Ownership and Schedule

### Parallel wave A1

- **Agent A — Authentication:** Task A1; owns `extension/auth.js`, adapted `options.*`, auth pages/routes/tests. It may modify `manifest.json` only through a primary-reviewed patch.
- **Agent B — Transcript resolution:** Task A2; owns `src/server/transcript/**`, the initial `src/server/jobs/process-jobs.ts` and `resolve-snapshot.ts`, transcript/job-status/internal-process routes, and provider/job tests. The primary reviews the service-secret and lease boundary.
- **Agent C — Capture persistence:** Task A4; owns capture repositories/domain/routes/tests. It cannot edit migrations or shared contracts.
- **Primary:** Reviews upstream intake, stable extension identity, token boundary, and RLS/API compatibility.

### Sequential integration A2

After A1/A2 pass, the primary assigns Task A3 to one agent because `extension/background.js`, `sidepanel.js`, and the processor extension are high-conflict files. That agent also owns the server AI adapter, three learning-artifact handlers, and their routes/tests; no other agent edits those paths concurrently.

After A3/A4 pass:

- one agent executes A5 exact save UI over `content.js`/`sidepanel.js`;
- then one agent executes A6 sync queue over `background.js`/`options.js`;
- primary executes A7 full extension/cloud integration.

### Gate A review checklist

- [ ] Source-to-target functions in `UPSTREAM_EXECUTION_LOG.md` match actual diffs.
- [ ] Direct provider keys/hosts are absent from packaged extension code.
- [ ] Key Quote and explanation payloads contain exact displayed text.
- [ ] Worker restart and account change cannot lose or reassign queued events.
- [ ] Provider fallback language is rejected.
- [ ] RLS, extension, integration, browser, build, and provenance commands pass.

## Batch B Ownership and Schedule

### Parallel wave B1

- **Agent A — Durable jobs:** Task B1; owns `src/server/jobs/**`, internal job route, job tests.
- **Agent B — Saved web:** Task B2; owns `src/features/home/**`, `src/features/saved/**`, Saved pages/public APIs/tests.
- **Agent C — Practice UI/AI:** Task B4 against frozen candidate fixtures; owns practice feature, prompt, task/attempt route files and tests.
- **Primary:** Owns service-role review, Cron/job endpoint integration, and candidate/attempt contract arbitration.

### Sequential integration B2

- Task B3 follows B1+B2 because it reads real candidate artifacts.
- Task B5 follows B3+B4 because it atomically crosses expression, occurrence, attempt, mastery, and review records.
- Primary executes B6 and is the only owner of integration-ledger updates.

### Gate B review checklist

- [ ] Failed jobs leave exact raw saves visible.
- [ ] Saved groups by one video and shows timestamp-grounded evidence.
- [ ] Selecting a candidate creates no mastery.
- [ ] A valid first attempt atomically creates expression, occurrence, `tried`, and due Practice.
- [ ] AI cannot set mastery/due fields.
- [ ] LLM Wiki provenance is method-only.
- [ ] Integration, browser, RLS, build, and AI fixture commands pass.

## Batch C Ownership and Schedule

### Parallel wave C1

- **Agent A — Retrieval:** Task C1; owns expression search repository/UI/tests.
- **Agent B — Due mastery:** Task C2; owns transfer/completion domain, due routes/UI/tests.
- **Agent C — Progress:** Task C3; owns progress repository/schema/page/tests.
- **Primary:** Confirms all queries carry explicit user scope and no vector dependency appears.

### Sequential integration C2

- Task C4 deletion runs after retrieval/mastery/progress because it must audit every dependent row.
- Task C5 owns shared extension/web state files and therefore runs without competing UI agents.
- Primary executes C6 complete mastery/deletion/recovery gates.

### Gate C review checklist

- [ ] Chinese retrieval is exact/substring/trigram and user-scoped.
- [ ] Two independent contexts on separate dates advance `owned` deterministically.
- [ ] Progress excludes save counts from mastery evidence.
- [ ] Deletion preview matches actual cascade/retention.
- [ ] Offline/auth-expired worker recovery syncs exactly once.
- [ ] Full extension, browser, database, build, and provenance commands pass.

## Delivery Schedule

Delivery is sequential because extension package identity, deployment origins, Supabase migrations/Cron/Vault, demo seed, and production state overlap.

- [ ] **D1:** Package allowlisted extension and audit provenance/license/secrets.
- [ ] **D2:** Seed deterministic demo account/video/cache.
- [ ] **D3:** Add minimal authenticated job observability and recovery docs; no learner-facing health feature.
- [ ] **D4:** Configure preview/production auth, RLS, Cron, providers, and complete terms gate.
- [ ] **D5:** Run fixture-backed complete local acceptance.
- [ ] **D6:** Deploy, run real-provider smoke tests, and record release evidence.

Investigation agents may diagnose independent failures, but only the primary changes shared environment configuration or declares delivery ready.

## Required Agent Brief

Every dispatched task brief contains:

```text
Canonical plan file and exact task number
Allowed files and forbidden shared files
Consumed and produced interfaces
Required failing-test command and expected failure
Required passing commands
Upstream repo/ref/file/function/reuse mode, or “no upstream code applies”
License/provenance action
Commit message
Required handoff: changed files, test output, upstream reuse evidence,
contract-change request, unresolved risks
```

## Reviewer Gate

The primary reviewer checks in this order:

1. task/spec compliance;
2. upstream code reuse and prohibited rewrite audit;
3. license and secret boundary;
4. type/interface consistency;
5. focused red/green evidence;
6. RLS/user-scope safety;
7. relevant integration gate;
8. clean diff and bounded ownership.

Reject a task when it claims an upstream function was reused but implements a parallel version, copies LLM Wiki GPLv3 code, changes shared contracts without approval, relies on service-worker lifetime, performs provider work in the raw-save transaction, or reports tests without fresh output.

## Completion Gate

The implementation is ready for the delivery plan only after Foundation and Gates A/B/C are recorded with commit IDs, exact commands, zero failing required tests, known risks, and no unresolved contract proposal.
