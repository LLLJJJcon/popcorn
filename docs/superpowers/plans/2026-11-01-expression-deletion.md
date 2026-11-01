# Saved and Vault deletion implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add consistent deletion to Saved video cards, Saved learning cards, Vault list/search cards and Vault details.
**Architecture:** Reuse a shared accessible confirmation dialog. Persist Saved expression removals on the saved item without rewriting generated artifacts or changing candidate indices. Archive Vault entries atomically with cancellation of pending reviews, retaining practice history.
**Tech Stack:** Next 16.3.1, React, Supabase PostgreSQL, Vitest.
**Spec:** User request in this conversation; interface decisions described in commentary.

## Global constraints
- Trash icon only, always visible beside the title and centered on the same horizontal line; keep a 44px hit area, hover title and accessible name. Destructive confirmation uses the existing warm palette.
- No deletion on first click; keyboard focus, Escape, pending state and retryable failure must work.
- All mutations require the authenticated owner and the configured same origin.
- Saved removal preserves original subtitles and Vault; Vault removal preserves Saved and historical attempts, and cancels future reviews.
- Keep original artifact candidate indices when hiding cards; hide across refresh, recovery and newer analysis artifacts.
- Preserve unrelated work and never reset the local database.

## Review focus
- Deleted first candidate must not change the practice index of its next sibling.
- A recover/poll refresh must not resurrect a deleted learning card.
- Cross-user IDs and cross-origin mutations must not write anything.
- Removed Vault entries must disappear from list, detail, search and pending reviews.
- Long Chinese titles and mobile touch targets must not overlap Delete.

### Task 1: Durable owner-scoped removal
- [x] Write failing HTTP and database tests for access control, saved removal, repeated deletion, review cancellation and retained history.
- [x] Add migration 20261101235900: saved_items.removed_expression_keys, user_expressions.removed_from_vault_at, service-only atomic removal functions, search filtering.
- [x] Add deletion handlers/runtime/routes and generated database types; filter Vault/progress reads and expose Saved removal keys.
- [x] Run endpoint and SQL tests, without deleting user content.

### Task 2: Shared deletion UI and page integration
- [x] Write failing dialog tests for confirmation, Escape/focus, pending/error/retry and cancelled requests.
- [x] Add shared DeleteAction dialog and styles; integrate video/moment/card/entry actions.
- [x] Preserve candidate indices, immediately hide removed cards, and refresh source data after success.
- [x] Test Saved/Vault overview/detail/search rendering and index preservation.

### Task 3: Verify
- [x] Run typecheck, full tests, lint and isolated production build.
- [x] Inspect desktop/mobile UI with browser tools using seeded synthetic data only for destructive checks.
- [x] Obtain a read-only code review and address important findings.

Verification: final `pnpm verify` passed against main 0f7feff: 1498 tests, typecheck and production build passed; lint has zero errors and four pre-existing warnings. Isolated migration upgrade and all 918 SQL assertions passed across 17 files. Read-only review findings (search invalidation, Today removal eligibility, archived promotion links, recovery status projection) were fixed and rechecked. Desktop title/icon centers measured at deltaY 0 with 44px icon-only targets; desktop and 390px layouts inspected without deleting user content.
