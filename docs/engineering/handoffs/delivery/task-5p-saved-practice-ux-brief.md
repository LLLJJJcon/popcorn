# Delivery recovery Task 5P — Saved candidate readability and exact return

- Plan/task: Unified Learning Workspace Task 9 UX follow-up; bounded hotfix approved by the user on 2026-09-05.
- Baseline commit: `8acfcd99f5f989cc7e9efea780300442ed0c2011`.
- Worktree: `/private/tmp/popcorn-saved-practice-navigation`.
- Allowed implementation files: `src/features/saved/candidate-expression.tsx`, `src/features/saved/candidate-list.tsx`, `src/features/saved/saved-video-detail.tsx`, `src/features/saved/saved-timeline.tsx`, `src/features/saved/saved-workspace.module.css`, `src/app/(app)/practice/[taskId]/page.tsx`, `src/features/practice/practice-session.tsx`, and `src/features/practice/practice-workspace.module.css`.
- Allowed report file: `docs/engineering/handoffs/delivery/task-5p-saved-practice-ux-report.md`.
- Forbidden: APIs, repositories, schemas/contracts, Provider code, migrations, root config, lockfile, extension, Vault date fields, and files outside the allowlist.
- Consumes: existing Saved video source ID, saved item ID, candidate artifact activation, and Practice task route.
- Produces: visually distinct candidate cards with clear English labels and obvious Watch/Practice actions; each Saved moment has an anchor; Saved-to-Practice navigation carries an internal exact return target; Practice renders a visible `Back to this Saved moment` link that returns to the same video and item.
- Safety: accept only a controller-constructed same-app `/saved/<UUID>#saved-item-<UUID>` return target; do not permit arbitrary or external redirects.
- Expected failing test: none. The user explicitly requested this quick repair without adding or running tests.
- Verification: inspect `git diff --check 8acfcd9..HEAD` and the baseline-to-HEAD allowlist only. Do not run test commands.
- Upstream reuse: no new upstream code; retain existing Popcorn components and route flow.
- License: do not copy any `nashsu/llm_wiki` GPLv3 code, tests, prompts, components, or assets.
- Handoff: commit implementation and report; return commit SHA, changed files, static inspection, risks, and report path.
