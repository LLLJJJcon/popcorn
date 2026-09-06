# Final main release — bilingual manuals

- Plan/request: final accepted Popcorn delivery; update Chinese and English operation manuals before integrating to `main`.
- Baseline commit: `a96edf151a8e3da660cd34588b756f64caffbc51`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/final-main-release/worktree`.

## Allowed files

- `README.md`
- `docs/operations/local-self-host.md`
- `docs/operations/user-guide.zh-CN.md`
- `docs/engineering/handoffs/delivery/final-main-release-manuals.md`

## Forbidden files and data

- Do not modify application, extension, database, migration, package, lockfile, root configuration, or generated release files.
- Do not read, copy, stage, or commit `.env.local` or any local credentials.
- Do not include a real Supadata key, model API key, service-role key, job secret, token, password, cookie, or private gateway URL. Documentation may contain only variable names and unmistakable placeholders.
- Do not claim that Practice list rows are selectable; that requested change was explicitly cancelled.

## Inputs and outputs

- Consume the existing commands and routes from `package.json`, `.env.example`, launcher scripts, `extension/manifest.json`, and application routes.
- Preserve the product boundary: current YouTube video only; Mandarin learning for English-speaking learners; snapshots rather than video files; mastery is only `tried -> reused -> owned`.
- Produce one concise English GitHub entry point in `README.md`, a complete English operating manual in `docs/operations/local-self-host.md`, and a materially equivalent Chinese manual in `docs/operations/user-guide.zh-CN.md`.

## Required manual coverage

1. Personal school-project positioning and feature overview.
2. Prerequisites and clone/install commands using `https://github.com/LLLJJJcon/popcorn.git`.
3. Exact one-time `.env.local` setup, with Supadata acquisition guidance and placeholders only.
4. Daily one-click start/stop and the destructive nature of `pnpm db:reset`.
5. Local account sign-in and generic OpenAI-compatible model gateway configuration; gateway name, base URL, model ID, and API key are user settings.
6. Unpacked Chrome extension build/load/reload steps.
7. End-to-end learning flow through YouTube extension, Saved, Practice, Vault, and Progress.
8. Retry/recovery guidance for service unavailable, no transcript, model timeout or malformed output, Practice evaluation failure, and local proxy routing.
9. A short professor-demo checklist.
10. Explicit credential safety: `.env.local` is ignored; keys must never be committed or pasted into issues/chat; gateway key is entered only in signed-in Web settings.

## Documentation RED/GREEN evidence

- RED: before editing, run a bounded text check demonstrating at least one required release item is missing or inconsistent (for example the real clone URL or a full English learning-flow section).
- GREEN: after editing, rerun the same check plus verify that every Markdown relative link in the three files resolves locally and that `git diff --check` passes.

## Review and handoff

- Commit only the allowed files.
- Write the handoff with RED/GREEN commands and results, changed files, residual risks, and commit SHA.
- License remains MIT; retain YouTube Digest attribution and do not introduce copied GPLv3 material.
