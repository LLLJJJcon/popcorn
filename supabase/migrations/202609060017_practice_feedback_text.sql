create function private.is_practice_feedback_text(value text, max_length integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and max_length > 0
    and pg_catalog.char_length(pg_catalog.btrim(value)) between 1 and max_length
    and value ~ '[A-Za-z]'
$$;

revoke all on function private.is_practice_feedback_text(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.is_practice_feedback_text(text, integer)
  to service_role;

alter table public.attempts
  drop constraint attempt_feedback_check,
  add constraint attempt_feedback_check check (
    private.is_practice_feedback_text(accuracy_feedback_english, 500)
    and private.is_practice_feedback_text(naturalness_feedback_english, 500)
    and private.is_practice_feedback_text(contextual_fit_feedback_english, 500)
  );

alter table public.practice_draft_attempts
  drop constraint practice_draft_attempt_feedback_check,
  add constraint practice_draft_attempt_feedback_check check (
    private.is_practice_feedback_text(accuracy_feedback_english, 500)
    and private.is_practice_feedback_text(naturalness_feedback_english, 500)
    and private.is_practice_feedback_text(contextual_fit_feedback_english, 500)
  );

comment on function private.is_practice_feedback_text(text, integer) is
  'Practice feedback must contain English prose but may quote Chinese learning content.';
