# CONTRACT-016 Source Deletion Handoff

## Result

- Added the service-role-only `delete_video_source(user, source, mode, now)` RPC with the exact two source-deletion modes.
- `remove_unpracticed_source` refuses promoted evidence and removes the complete source/save/artifact/job/draft graph.
- `remove_source_keep_evidence` retains the semantic expression card and canonical practice, attempt, mastery, review, and receipt IDs while deleting source identity, transcript bodies, generated content, occurrences, timestamps, segment IDs, URLs, and raw saves.
- A retained expression sense is marked by `source_deleted_at` and has null source/save locators. The immutable promotion receipt moves its occurrence UUID to `deleted_occurrence_id`, clears the live occurrence FK, and preserves exact replay.
- Promotion replay now checks the immutable receipt before the staged source graph. New promotions still delegate to the frozen source-active implementation.
- Active source jobs are terminalized inside the transaction before private inputs, pins, and jobs are removed. A worker holding an old lease can no longer publish.

## TDD evidence

RED:

```text
supabase test db supabase/tests/source_deletion.sql
failed because delete_video_source, source_deleted_at, and deleted_occurrence_id did not exist
```

GREEN:

```text
supabase db reset
all 16 migrations applied from a clean database

supabase test db supabase/tests/source_deletion.sql
20/20 passed

supabase test db
9 files, 656/656 passed

supabase gen types typescript --local --schema public,private
generated output matched src/types/database.generated.ts after normalizing the CLI's extra blank EOF line

tsc --noEmit
passed

git diff --check
passed
```

## Boundary and residual risk

- This is source deletion only. Account deletion, archive/undo, audit history, quotas, and hosted operations remain out of scope.
- Canonical practice prompts and learner responses intentionally remain because the product contract explicitly retains practiced evidence. They no longer carry a source ID, URL, video title, transcript body, occurrence, segment list, or playback time.
- The later Batch C Task 4 application slice must render tombstoned Vault cards as `Source deleted` and must call this RPC as its sole deletion write; it may not edit CONTRACT-016.
- YouTube Digest code is not used here. No LLM Wiki GPLv3 code, tests, prompts, components, or assets were copied.
