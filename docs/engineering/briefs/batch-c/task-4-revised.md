# Batch C Revised Task 4 — Source Deletion Feature Brief

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`, Task 4
- Baseline: `8bdfa2a24aa790195d39e1496b80613a94c7fe4e`
- Worktree: `/private/tmp/popcorn-batch-c-4-revised`
- Contract consumed: frozen CONTRACT-016 `delete_video_source(p_user_id, p_video_source_id, p_mode, p_now)`

## Scope and ownership

The application previews one owned YouTube source, derives exactly one of
`remove_unpracticed_source` or `remove_source_keep_evidence`, and sends that
mode to CONTRACT-016. The RPC is the sole deletion write. The Saved detail
page owns the confirmation UI; retained Vault cards own only canonical
semantic fields, canonical `attempts`, mastery, and reviews after the source
graph is removed.

No migration, generated type, root configuration, lockfile, extension,
account deletion, archive, undo, export, analytics, or Provider behavior is
part of this implementation task.

## Required boundaries

- Every preview query binds the authenticated `user_id`; the promoted count
  also binds the joined expression-sense owner and source.
- Unknown and cross-owner source IDs are indistinguishable and unavailable.
- Commit re-runs preview, rejects a mode mismatch before mutation, and calls
  `delete_video_source` exactly once for a matching request.
- Responses are `Cache-Control: no-store`, bounded, and never expose database
  or RPC details.
- Confirmation remains disabled until the learner explicitly acknowledges
  the displayed source title, save count, affected expression count, and
  retention effect.
- A tombstoned Vault card shows exact `Source deleted`, no link, timestamp, or
  evidence text, while retaining canonical attempt history.

## TDD and verification

RED must be the missing domain/routes/dialog plus the old Vault dependency on
`practice_draft_attempts` and the active occurrence/source graph. GREEN is the
focused Vitest command, TypeScript, scoped ESLint, and `git diff --check` from
the task brief.

## Upstream and license

No YouTube Digest function or file is relevant to deletion, so no code is
reused from `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
No LLM Wiki method is used, and no GPLv3 code, tests, prompts, components, or
assets are copied from `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6`.
Existing MIT notices and provenance remain unchanged.
