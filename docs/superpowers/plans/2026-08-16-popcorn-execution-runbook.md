# Popcorn Multi-Agent Execution Runbook

This runbook tells a primary Codex Agent how to execute the Popcorn plans without relying on conversation memory. It is an execution protocol, not an instruction to start work automatically.

## 1. Canonical Inputs

The primary Agent must read these files before implementation:

1. docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md
2. docs/superpowers/plans/2026-08-16-popcorn-agent-orchestration.md
3. docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md
4. docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md
5. docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md
6. docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md
7. docs/superpowers/plans/2026-08-16-popcorn-delivery-demo.md

Conflict priority:

1. The user's latest explicit instruction.
2. The approved design.
3. The module implementation plan.
4. The orchestration plan.
5. An Agent's interpretation.

If levels 1 through 3 conflict, stop and ask the user instead of guessing.

## 2. Copy-Paste Instruction for the Primary Agent

Copy this block into a new Codex task when implementation should begin:

    Execute the Popcorn desktop web development plans in this repository.

    Read first:
    - docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md
    - docs/superpowers/plans/2026-08-16-popcorn-execution-runbook.md
    - docs/superpowers/plans/2026-08-16-popcorn-agent-orchestration.md
    - all five module plans linked by the orchestration plan

    Use:
    - superpowers:using-git-worktrees before implementation
    - superpowers:test-driven-development for every implementation task
    - superpowers:dispatching-parallel-agents only for independent workstreams explicitly listed in the runbook
    - superpowers:requesting-code-review at every task gate and for final review
    - superpowers:verification-before-completion before every completion claim
    - superpowers:finishing-a-development-branch after the full acceptance suite passes

    Execution rules:
    1. Do not work directly on main.
    2. Do not start Batch A until the entire foundation plan passes.
    3. Use one isolated worktree per parallel workstream.
    4. Use a fresh implementation Agent per numbered task. The worktree persists; conversation context does not.
    5. Never let two active Agents edit the same file.
    6. Shared contracts, migrations, package.json, root configuration, and integration routes are primary-Agent-owned.
    7. Generate a task brief for each numbered task.
    8. Require every Agent to commit its task, write a durable handoff report, and return DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED.
    9. Review spec compliance and code quality before dispatching the next task in that workstream.
    10. Update docs/engineering/execution-ledger.md after every approved task and commit a checkpoint after every integration gate.
    11. Resume from the ledger and Git history after interruption; never repeat a reviewed task.
    12. Continue until blocked, a real plan conflict requires my decision, or the complete plan is verified.

    Start with a read-only pre-flight audit. Report plan conflicts as one batched question before changing files. If clean, create an isolated implementation worktree and begin Foundation Task 1.

## 3. Operating Model

The primary Agent owns the integration branch, shared interfaces, migrations, worktrees, briefs, reviews, ledger, integration, and full-suite verification.

An implementation Agent owns exactly one numbered task. It receives:

- one task brief;
- worktree path and branch;
- baseline commit;
- consumed interfaces;
- allowed and forbidden paths;
- durable report path;
- required tests and status contract.

A reviewer receives:

- the same task brief;
- the handoff report;
- a baseline-to-head review package;
- approved global constraints;
- the requirement to return spec-compliance and code-quality verdicts.

### Worktree safety pre-flight

Before creating the first implementation worktree:

1. Detect whether the current checkout is already a linked worktree.
2. Prefer a native Codex worktree mechanism when one is available.
3. For manual Git worktrees, use the project-local .worktrees directory.
4. Run git check-ignore -q .worktrees.
5. If it is not ignored, add only .worktrees/ to .gitignore, commit that safety change, and then create worktrees.
6. Never copy the repository's existing untracked presentation/report files into Agent worktrees as task context.

## 4. Durable State

Chat is not the system of record.

### 4.1 Git commits

Every implementation and accepted fix is committed on its workstream branch. A task without a commit is incomplete.

### 4.2 Execution ledger

Before Foundation Task 1, create docs/engineering/execution-ledger.md:

    # Popcorn Execution Ledger

    ## Current Position
    - Stage: foundation
    - Next task: foundation task 1
    - Integration branch: feat/popcorn-desktop-web
    - Last verified commit: record the actual SHA here

    ## Completed Tasks
    | Plan | Task | Branch | Base | Head | Review | Verification |
    |---|---:|---|---|---|---|---|

    ## Open Concerns
    | ID | Severity | Owner | Description | Required action |
    |---|---|---|---|---|

    ## Contract Changes
    | ID | Requested by | Decision | Contract commit | Consumers notified |
    |---|---|---|---|---|

Replace “record the actual SHA here” before the first ledger commit. After every clean review, append an actual base/head row and commit the ledger.

### 4.3 Handoff reports

Each task commits:

    docs/engineering/handoffs/<plan-slug>/task-<number>.md

Required structure:

    # Task Handoff
    - Status:
    - Plan and task:
    - Worktree:
    - Branch:
    - Baseline SHA:

    ## Implemented
    ## Interfaces consumed
    ## Interfaces produced
    ## Files changed
    ## TDD evidence
    ### RED
    ### GREEN
    ## Broader verification
    ## Contract or migration changes requested
    ## Risks and follow-up

Reports are an explicit exception to feature path ownership. They contain no secrets, raw user data, full provider responses, or copied chat history.

The report does not contain its own final commit SHA because that value does not exist until after the report is committed. The Agent returns the created SHA; the primary Agent verifies it and records it in the ledger.

### 4.4 Integration checkpoints

At each gate, create and commit:

    docs/engineering/checkpoints/gate-a.md
    docs/engineering/checkpoints/gate-b.md
    docs/engineering/checkpoints/gate-c.md
    docs/engineering/checkpoints/release.md

Each records baseline SHA, workstream heads, cherry-pick order, conflicts, contract changes, verification commands, results, and next permitted stage.

## 5. Task-Brief Generation

Use:

    brief_tool="/Users/liangjing/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.1/skills/subagent-driven-development/scripts/task-brief"
    mkdir -p .superpowers/sdd/briefs
    "$brief_tool" PLAN_FILE TASK_NUMBER ".superpowers/sdd/briefs/PLAN_SLUG-task-TASK_NUMBER.md"

Replace PLAN_FILE, TASK_NUMBER, and PLAN_SLUG with real values before running.

The plans contain 40 extractable numbered tasks:

- Foundation: 1–6.
- Batch A: 1–9.
- Batch B: 1–7.
- Batch C: 1–9.
- Delivery: 1–9.

## 6. Implementation Agent Prompt

The controller fills every bracket with an actual value:

    You are implementing one Popcorn task in an isolated worktree.

    Read this first; it is your complete requirement:
    [absolute task brief path]

    Context:
    - Product: English desktop web app for native English speakers learning Mandarin Chinese.
    - Interface and AI explanations: English.
    - Learning content and learner output: Simplified Chinese.
    - Baseline commit: [actual SHA]
    - Worktree: [absolute path]
    - Branch: [actual branch]

    Allowed files:
    [exact task file list]
    docs/engineering/handoffs/[plan slug]/task-[number].md

    Forbidden unless this is a primary-owned task:
    - src/contracts/**
    - supabase/migrations/**
    - package.json and lockfile
    - root configuration
    - another active workstream's files

    Requirements:
    1. Ask before starting if the brief conflicts with code or frozen contracts.
    2. Follow TDD and capture real RED and GREEN evidence.
    3. Implement only this numbered task.
    4. Run focused and broader verification from the brief.
    5. Self-review.
    6. Commit code and handoff report.
    7. Return only status, commit SHA/subject, one-line test summary, concerns, and report path.

    Valid statuses: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED.
    Do not edit plan checkboxes; the primary Agent owns progress.

## 7. Review Gate

For every returned implementation:

1. Confirm status and read the report.
2. Verify the commit exists.
3. Verify changed paths are allowed.
4. Generate a review package from the recorded baseline, never HEAD~1:

       review_tool="/Users/liangjing/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.1/skills/subagent-driven-development/scripts/review-package"
       "$review_tool" BASE_SHA HEAD_SHA

5. Dispatch a fresh reviewer with brief, report, review package, and global constraints.
6. Require Spec compliance: PASS/FAIL and Code quality: APPROVED/findings.
7. Send Critical or Important findings to a fix Agent.
8. Require new test evidence and re-review.
9. Only after both verdicts pass, update and commit the ledger.

## 8. Exact Parallel Schedule

### Foundation

Run tasks 1–6 sequentially. No feature Agents run.

### Batch A

From the Foundation checkpoint:

- Identity stream: tasks 1 then 2.
- Content stream: tasks 3 then 4 then 5.
- AI stream: tasks 6 then 7 then 8.

The three streams may run concurrently, using one fresh Agent per task. Task 9 is primary integration after tasks 1–8 pass review.

### Batch B

From Gate A:

- Practice stream: tasks 1 then 2.
- Memory stream: tasks 3 then 4.
- Desktop stream: task 5.

Tasks 6 and 7 are sequential primary integration after tasks 1–5 pass review.

### Batch C

Primary Agent completes migration task 1 first. Then:

- Progress stream: tasks 2 then 3.
- Relations stream: tasks 4 then 5.
- Chinese quality stream: tasks 6 then 7 then 8.

Task 9 is primary integration after tasks 2–8 pass review.

### Delivery

Run tasks 1–9 sequentially. Parallel investigation is allowed for independent failures, but deployments and migration state remain primary-owned.

## 9. Resume Instruction

If execution is interrupted, copy:

    Resume the Popcorn desktop web implementation from durable state.

    Read:
    - docs/superpowers/plans/2026-08-16-popcorn-execution-runbook.md
    - docs/engineering/execution-ledger.md
    - the latest file under docs/engineering/checkpoints/
    - git log --oneline --decorate --all
    - git worktree list

    Treat reviewed ledger tasks as complete. Verify every recorded head SHA exists. Resume at the first unreviewed task. Do not re-run completed tasks. If ledger and Git disagree, report the exact mismatch before changing code.

## 10. Simulated End-to-End Handoff

No implementation is performed in this simulation.

| Step | Durable input | Durable output | Residual loss risk |
|---|---|---|---|
| Start | Design and plans | Integration branch and ledger | Low |
| Foundation task | Brief and baseline SHA | Commit, report, review | Low |
| Foundation gate | Six reviewed tasks | Frozen-contract checkpoint | Low |
| Batch A | Frozen SHA and three worktrees | Reviewed stream heads | Low |
| Gate A | Named heads and tests | Integrated checkpoint | Low |
| Batch B | Gate A and frozen events | Practice, memory, desktop heads | Low |
| Gate B | Reviewed diffs | Persistent text-loop checkpoint | Low |
| Batch C | Gate B and pgvector migration | Progress, relations, Chinese QA | Low |
| Gate C | Reviewed heads and full tests | Pre-delivery checkpoint | Low |
| Delivery | Gate C | Deployment and acceptance record | Medium until credentials exist |
| Resume | Ledger, checkpoints, Git, reports | Exact next task | Low |

## 11. Risks Found and Controls

### Non-numeric task names

The standard task-brief helper only extracts integer task headings. Batch A/B/C plans were renumbered. A dry run extracted all 40 tasks successfully.

### Shared checkout conflicts

Parallel Agents share the filesystem unless isolated. Every stream must use a separate worktree. Without worktrees, parallel implementation must not start.

### Chat-only progress

Conversation context can compact. Git commits, committed reports, the ledger, and checkpoints carry state.

### Unverified success reports

DONE alone is insufficient. The controller checks commit, paths, report, diff package, review verdicts, and test evidence.

### Contract drift

Feature Agents request contract changes in reports. Only the primary Agent edits frozen contracts or migrations and records the decision.

Contract-change protocol:

1. Pause every workstream that consumes the affected contract.
2. Primary Agent decides the exact change and adds or updates contract tests.
3. Primary Agent commits the shared change and records the new baseline in the ledger.
4. Rebase each affected workstream branch onto the new baseline before further edits.
5. Re-run its focused baseline tests.
6. Regenerate task briefs if signatures or exact values changed.
7. Resume only after all affected branches report the same contract commit.

### Stale parallel branches

Each batch starts from a checkpoint SHA and integrates one reviewed stream at a time, with verification after each.

### Deleted scratch files

Briefs and review packages are reproducible. Reports, ledger, and checkpoints are committed.

### External credentials

Missing Supabase, OpenAI, Vercel, or demo credentials is a legitimate scoped BLOCKED state. Agents must not invent or expose credentials.

## 12. Assessment

With this protocol, Agent handoff does not depend on chat memory. Remaining risk is external state or a user decision that changes a frozen contract; both must be recorded as blockers rather than guessed around.
