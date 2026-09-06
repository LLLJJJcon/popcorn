# Practice mixed-language feedback persistence repair

## Identity

- Plan/task: Delivery recovery — `Check my response` mixed-language feedback persistence.
- Baseline commit: `fe5bc00e33e1869c9be3702f997de69fdb1ccfb6`.
- Branch: `codex/practice-feedback-persistence`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/popcorn-practice-feedback-persistence`.

## Diagnosed failure

- The reported `基本款` request first returned 503 after the configured model exceeded 30 seconds.
- Its next request reached persistence but returned 500 because a controller-created demo `due_at` used microseconds while the generated Practice task used milliseconds. The local five-row demo data has already been realigned to millisecond precision.
- A separate confirmed persistence mismatch remains: TypeScript now accepts Practice feedback that contains English plus quoted Chinese, while the live `attempts` and `practice_draft_attempts` constraints still call ASCII-only `private.is_basic_latin_english`.

## Allowed files

- `supabase/migrations/202609060017_practice_feedback_text.sql`
- `supabase/tests/due_practice_completion.sql`
- `supabase/tests/practice_drafts.sql`
- `docs/engineering/handoffs/practice-mixed-feedback-persistence.md`

All other files are forbidden, including Web UI, extension files, TypeScript contracts, routes, root configuration, lockfiles, existing migrations, and generated database types.

## Required contract

- Add a private immutable SQL predicate for Practice feedback only.
- Each feedback value must be non-null, nonblank, at most 500 PostgreSQL characters, and contain at least one ASCII Latin letter.
- Chinese and other Unicode punctuation/text may coexist with the required English text.
- Replace only the feedback check constraints on `public.attempts` and `public.practice_draft_attempts` to use that predicate.
- Preserve score, response, assistance, independence, owner, provenance, atomic completion, replay, mastery, and scheduling constraints.
- Keep the helper private and revoke public execution.
- Do not modify `private.is_basic_latin_english`, because all non-Practice English-only contracts must remain strict.
- Existing local data is compatible: 5 canonical attempts and 7 draft attempts exist; maximum feedback length is 238.

## TDD

First modify the two existing focused pgTAP files so a valid successful due completion and a valid draft evaluation persist feedback containing both English and Chinese. Record baseline RED from the old ASCII-only constraints. Then add the smallest new migration and record GREEN.

Also prove pure-Chinese, blank, over-500-character, and non-string/NULL values remain rejected where applicable; preserve existing atomic rollback checks.

Focused verification:

- Run `supabase/tests/due_practice_completion.sql` and `supabase/tests/practice_drafts.sql` against a clean test database through the repository's established DB-test command.
- Run `git diff --check fe5bc00e33e1869c9be3702f997de69fdb1ccfb6..HEAD`.

Do not run browser, extension, full application, or live Provider tests. A local migration application and one read-only post-application constraint check are controller integration steps after review.

## Upstream and license

- No upstream code is needed.
- Do not copy YouTube Digest or LLM Wiki code, prompts, tests, components, or assets.
- GPLv3 content must remain absent.

Commit implementation and handoff. Return commit SHA, exact RED/GREEN evidence, verification results, risk, and report path.
