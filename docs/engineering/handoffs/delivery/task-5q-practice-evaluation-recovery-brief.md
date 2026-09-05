# Delivery recovery Task 5Q — resilient Practice evaluation

- Plan/task: Unified Learning Workspace Task 6/7 live-UX repair; bounded hotfix approved by the user on 2026-09-05.
- Baseline commit: `8acfcd99f5f989cc7e9efea780300442ed0c2011`.
- Worktree: `/private/tmp/popcorn-practice-evaluation-recovery`.
- Allowed implementation files: `src/server/ai/openai-compatible-provider.ts`, `src/server/ai/prompts/evaluate.v1.ts`, `src/server/repositories/attempt-repository.ts`, and `src/server/domain/complete-due-practice.ts`.
- Allowed report file: `docs/engineering/handoffs/delivery/task-5q-practice-evaluation-recovery-report.md`.
- Forbidden: client/UI files, public contracts, migrations, shared database types, gateway credentials/config UI, root config, lockfile, extension, and files outside the allowlist.
- Consumes: the active user's frozen gateway pin, existing OpenAI-compatible transport, Practice evaluation prompt, and append-only attempt repository.
- Produces: tolerate a single ordinary Markdown JSON fence from compatible models; preserve valid scoring even when optional natural-revision coaching is malformed or omits the exact target; derive assistance/independent-use from the trusted submission rather than model claims; allow up to 60 seconds for Practice evaluation only. Never fabricate dimension scores or persist an attempt unless all three scored dimensions are valid.
- Root-cause evidence: one active draft and zero attempts place failure before persistence; the same gateway already created the draft, while recent jobs show output-invalid/unavailable behavior. The current all-or-nothing parser rejects common harmless formatting/coaching variance.
- Expected failing test: none. The user explicitly requested this quick repair without adding or running tests.
- Verification: inspect `git diff --check 8acfcd9..HEAD`; confirm only allowlisted files/report changed; reason through timeout scope and parser boundaries. Do not run test or live Provider commands and do not read/output the API key.
- Upstream reuse: continue using the existing Provider-neutral OpenAI-compatible gateway; no upstream source copying.
- License: do not copy any `nashsu/llm_wiki` GPLv3 code, tests, prompts, components, or assets.
- Handoff: commit implementation and report; return commit SHA, changed files, static inspection, risks, and report path.
