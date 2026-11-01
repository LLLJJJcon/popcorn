# Group 1 — Saved UI implementation report

Date: 2026-11-01. Scope: task B in `group-1-execution-plan.md`; confirmed sections 4.5–4.8 only. No group 2–4 behavior, contracts, backend, package scripts, seed, E2E or migration changes were made by this agent.

## Findings and changes

The existing editor and learning-card components already implement the confirmed product behavior. Retained their implementation rather than rewriting it.

- `src/features/saved/highlight-editor.test.tsx`: added three interaction tests using real DOM selections and the real editor. They verify punctuation-trimmed endpoints in the Mark POST, consecutive additions with both resulting marks visible, reopening from server-supplied marks, cross-line selection through existing marked runs, rendering the server's replacement list without stale overlapping marks, and preserving the current selection/original marks after a failed save so the user can retry.
- `src/features/saved/candidate-expression.tsx`: explicitly guards absent confidence in the legacy-only notice branch. This accommodates the shared schema's optional confidence while retaining the old low-confidence notice for legacy cards. Modern cards continue to have no confidence notice.
- `src/features/saved/learning-card.test.tsx` and `marked-candidate-list.test.tsx`: removed confidence from modern-card fixtures. The real card rendering and candidate-response parsing therefore run with the current modern shape.
- `extension/tests/save-payloads.test.js`: inspected and verified; no changes needed. Existing cases already cover key-quote context, 3-before/2-after bounds, cross-line UTF-16 evidence and actual Save handlers.

## Test-first record

Before changes, the five relevant Saved UI files passed 44 tests. New interaction tests were added before making the confidence compatibility guard. The first editor run produced 9 passed / 1 failed: the failing cross-line test queried a space where the accessible name retained a newline. Inspection confirmed correct replacement DOM and exact cross-line text; the test query was corrected to accept whitespace. This was a test assertion issue, not a production defect.

The added editing coverage otherwise passed against the existing implementation. No production editing bug or artificial RED condition is claimed. The only production change is the schema-related undefined guard requested by the controller, with legacy behavior covered by the existing candidate-list suite.

## Commands and observed results

| Command | Result |
| --- | --- |
| `pnpm exec vitest run src/features/saved/highlight-editor.test.tsx src/features/saved/learning-card.test.tsx src/features/saved/marked-candidate-list.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-video-detail.test.tsx` before edits | 5 files passed; 44 tests passed |
| `pnpm exec vitest run src/features/saved/highlight-editor.test.tsx` after adding interactions | 1 file failed; 9 passed / 1 failed because of test accessible-name whitespace |
| Same five-file command after correcting the query | 5 files passed; 47 tests passed |
| `pnpm exec vitest run src/features/saved` after removing modern fixture confidence | 11 files passed; 66 tests passed; exit 0 |
| `node --test extension/tests/save-payloads.test.js` | 29 tests passed; 0 failed / skipped; exit 0 |
| `pnpm exec eslint src/features/saved/candidate-expression.tsx src/features/saved/highlight-editor.test.tsx src/features/saved/learning-card.test.tsx src/features/saved/marked-candidate-list.test.tsx` | No diagnostics; exit 0 |

## Requirement evidence and limits

- Target-only text and rationale tooltip: `highlight-editor.tsx` renders only target segments; `<mark title>` carries the rationale, shared for user/model marks.
- Status copy, gateway setup and retry, removal/Undo and five-second expiry: existing `highlight-editor.test.tsx` cases.
- Manual marking, trimming, consecutive additions and cross-line replacement: the three added interaction tests.
- Analyze empty/all-analyzed disabling, body-free Analyze, failed-mark retry, card preservation and location-based deduplication: `marked-candidate-list.test.tsx`.
- Default card fields, examples, More details, tags, unavailable examples and `Practice anyway`: `learning-card.test.tsx`.
- Legacy v1/v2 presentation and older-version notice: `candidate-list.test.tsx` and unchanged legacy rendering branch.
- Persisted target precedence and legacy moment-gap fallback: `saved-highlight-material.test.ts`.

The editor interaction tests mock only the HTTP boundary with explicit server responses. They establish UI request payloads and rendering of server-confirmed marks; they do not prove database durability, RLS or transactional overlap replacement. Those require the backend/SQL and independent E2E acceptance gates. Browser pointer geometry, hover appearance and full application reload persistence likewise remain for independent browser verification. This report is implementer verification, not independent group acceptance.

No commits, pushes or reviewer agents were created by this agent. No unresolved issue was found within task B's owned implementation.
