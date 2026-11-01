-- This hash is only for first-practice scenario deduplication. Historical
-- practice_tasks.context_fingerprint / mastery evidence are never recomputed.
create or replace function private.practice_situation_fingerprint(p_text text) returns text
language sql immutable strict set search_path=pg_catalog as $$
  select encode(extensions.digest(convert_to(lower(regexp_replace(normalize(p_text,NFKC),'[[:punct:][:space:]]','','g')),'UTF8'),'sha256'),'hex')
$$;
update public.practice_drafts set scenario_fingerprint=private.practice_situation_fingerprint(prompt_chinese);
