create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

create function private.are_valid_stable_segment_ids(segment_ids text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    cardinality(segment_ids) between 1 and 32
    and not exists (
      select 1 from unnest(segment_ids) as supplied(segment_id)
      where supplied.segment_id is null
        or length(supplied.segment_id) not between 1 and 200
        or supplied.segment_id <> btrim(supplied.segment_id)
    ),
    false
  )
$$;

revoke all on function private.are_valid_stable_segment_ids(text[]) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.are_valid_stable_segment_ids(text[]) to authenticated, service_role;

create function private.is_target_chinese(value text, maximum_length integer)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  character_index integer;
  code_point integer;
  utf16_length integer := 0;
  has_han boolean := false;
begin
  if value is null or length(btrim(value)) = 0 then
    return false;
  end if;

  for character_index in 1..char_length(value) loop
    code_point := ascii(substr(value, character_index, 1));
    utf16_length := utf16_length + case when code_point > x'ffff'::integer then 2 else 1 end;
    if utf16_length > maximum_length then
      return false;
    end if;

    if code_point between x'2e80'::integer and x'2e99'::integer
      or code_point between x'2e9b'::integer and x'2ef3'::integer
      or code_point between x'2f00'::integer and x'2fd5'::integer
      or code_point in (x'3005'::integer, x'3007'::integer)
      or code_point between x'3021'::integer and x'3029'::integer
      or code_point between x'3038'::integer and x'303b'::integer
      or code_point between x'3400'::integer and x'4dbf'::integer
      or code_point between x'4e00'::integer and x'9fff'::integer
      or code_point between x'f900'::integer and x'fa6d'::integer
      or code_point between x'fa70'::integer and x'fad9'::integer
      or code_point between x'16fe2'::integer and x'16fe3'::integer
      or code_point between x'16ff0'::integer and x'16ff6'::integer
      or code_point between x'20000'::integer and x'2a6df'::integer
      or code_point between x'2a700'::integer and x'2b81d'::integer
      or code_point between x'2b820'::integer and x'2cead'::integer
      or code_point between x'2ceb0'::integer and x'2ebe0'::integer
      or code_point between x'2ebf0'::integer and x'2ee5d'::integer
      or code_point between x'2f800'::integer and x'2fa1d'::integer
      or code_point between x'30000'::integer and x'3134a'::integer
      or code_point between x'31350'::integer and x'33479'::integer then
      has_han := true;
    end if;
  end loop;
  return has_han;
end
$$;

create function private.is_basic_latin_english(value text, maximum_length integer)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  character_index integer;
  code_point integer;
  has_ascii_letter boolean := false;
begin
  if value is null or length(value) = 0 or length(value) > maximum_length then
    return false;
  end if;

  for character_index in 1..char_length(value) loop
    code_point := ascii(substr(value, character_index, 1));
    if not (code_point between 9 and 13 or code_point between 32 and 126) then
      return false;
    end if;
    if code_point between 65 and 90 or code_point between 97 and 122 then
      has_ascii_letter := true;
    end if;
  end loop;
  return has_ascii_letter;
end
$$;

revoke all on function private.is_target_chinese(text, integer) from public;
revoke all on function private.is_basic_latin_english(text, integer) from public;
grant execute on function private.is_target_chinese(text, integer) to authenticated, service_role;
grant execute on function private.is_basic_latin_english(text, integer) to authenticated, service_role;

create function private.is_valid_saved_item_payload(
  item_kind text,
  item_payload jsonb,
  indexed_start_seconds numeric,
  item_youtube_video_id text
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  required_keys text[];
  allowed_keys text[];
  plain_text_keys text[] := array[]::text[];
  chinese_text_keys text[] := array[]::text[];
  english_text_keys text[] := array[]::text[];
  context_keys text[] := array[]::text[];
  segment_keys text[] := array[]::text[];
  time_key text;
  key_name text;
  number_value numeric;
begin
  if jsonb_typeof(item_payload) <> 'object' or indexed_start_seconds is null then
    return false;
  end if;

  case item_kind
    when 'video' then
      required_keys := array['canonicalUrl','title','channel','thumbnailUrl','durationSeconds',
        'description','currentTimeSeconds','requestNativeSnapshot'];
      allowed_keys := required_keys;
      plain_text_keys := array['canonicalUrl','title','channel','thumbnailUrl'];
      time_key := 'currentTimeSeconds';
    when 'player_moment' then
      required_keys := array['capturedSecond'];
      allowed_keys := required_keys;
      time_key := 'capturedSecond';
    when 'subtitle_row' then
      required_keys := array['segmentId','originalChinese','startSeconds','endSeconds','contextBefore','contextAfter'];
      allowed_keys := required_keys || array['englishTranslation'];
      plain_text_keys := array['segmentId'];
      chinese_text_keys := array['originalChinese'];
      context_keys := array['contextBefore','contextAfter'];
      time_key := 'startSeconds';
    when 'subtitle_selection' then
      required_keys := array['originalChinese','segmentIds','startSeconds','endSeconds','startOffset','endOffset',
        'contextBefore','contextAfter'];
      allowed_keys := required_keys || array['englishTranslation'];
      chinese_text_keys := array['originalChinese'];
      context_keys := array['contextBefore','contextAfter'];
      segment_keys := array['segmentIds'];
      time_key := 'startSeconds';
    when 'key_quote' then
      required_keys := array['exactQuote','quoteSeconds','segmentIds'];
      allowed_keys := required_keys;
      chinese_text_keys := array['exactQuote'];
      segment_keys := array['segmentIds'];
      time_key := 'quoteSeconds';
    when 'ai_explanation' then
      required_keys := array['selectedChinese','englishExplanation','segmentIds','startSeconds','endSeconds',
        'contextBefore','contextAfter'];
      allowed_keys := required_keys;
      chinese_text_keys := array['selectedChinese'];
      english_text_keys := array['englishExplanation'];
      context_keys := array['contextBefore','contextAfter'];
      segment_keys := array['segmentIds'];
      time_key := 'startSeconds';
    else
      return false;
  end case;

  if not (item_payload ?& required_keys)
    or exists (
      select 1 from jsonb_object_keys(item_payload) as supplied(key)
      where not (supplied.key = any(allowed_keys))
    ) then
    return false;
  end if;

  foreach key_name in array plain_text_keys loop
    if jsonb_typeof(item_payload -> key_name) <> 'string'
      or length(btrim(item_payload ->> key_name)) = 0 then
      return false;
    end if;
  end loop;

  foreach key_name in array chinese_text_keys loop
    if jsonb_typeof(item_payload -> key_name) <> 'string'
      or not private.is_target_chinese(
        item_payload ->> key_name,
        case key_name
          when 'originalChinese' then 10000
          when 'exactQuote' then 10000
          when 'selectedChinese' then 10000
          else 10000
        end
      ) then
      return false;
    end if;
  end loop;

  foreach key_name in array english_text_keys loop
    if jsonb_typeof(item_payload -> key_name) <> 'string'
      or not private.is_basic_latin_english(item_payload ->> key_name, 10000) then
      return false;
    end if;
  end loop;

  if item_payload ? 'englishTranslation'
    and (jsonb_typeof(item_payload -> 'englishTranslation') <> 'string'
      or not private.is_basic_latin_english(item_payload ->> 'englishTranslation', 10000)) then
    return false;
  end if;

  foreach key_name in array context_keys loop
    if jsonb_typeof(item_payload -> key_name) <> 'array'
      or jsonb_array_length(item_payload -> key_name) > 3
      or exists (
        select 1 from jsonb_array_elements(item_payload -> key_name) as element(value)
        where jsonb_typeof(element.value) <> 'string'
          or not private.is_target_chinese(element.value #>> '{}', 2000)
      ) then
      return false;
    end if;
  end loop;

  foreach key_name in array segment_keys loop
    if jsonb_typeof(item_payload -> key_name) <> 'array'
      or jsonb_array_length(item_payload -> key_name) not between 1 and 32
      or exists (
        select 1 from jsonb_array_elements(item_payload -> key_name) as element(value)
        where jsonb_typeof(element.value) <> 'string'
          or length(element.value #>> '{}') not between 1 and 200
          or element.value #>> '{}' <> btrim(element.value #>> '{}')
      ) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(item_payload -> time_key) <> 'number' then
    return false;
  end if;
  number_value := (item_payload ->> time_key)::numeric;
  if number_value not between 0 and 604800 or indexed_start_seconds <> number_value then
    return false;
  end if;

  if item_kind in ('subtitle_row','subtitle_selection','ai_explanation') then
    if jsonb_typeof(item_payload -> 'endSeconds') <> 'number'
      or (item_payload ->> 'endSeconds')::numeric not between number_value and 604800 then
      return false;
    end if;
  end if;

  if item_kind = 'subtitle_row' then
    if length(item_payload ->> 'segmentId') not between 1 and 200
      or item_payload ->> 'segmentId' <> btrim(item_payload ->> 'segmentId') then
      return false;
    end if;
  elsif item_kind = 'subtitle_selection' then
    if jsonb_typeof(item_payload -> 'startOffset') <> 'number'
      or jsonb_typeof(item_payload -> 'endOffset') <> 'number'
      or trunc((item_payload ->> 'startOffset')::numeric) <> (item_payload ->> 'startOffset')::numeric
      or trunc((item_payload ->> 'endOffset')::numeric) <> (item_payload ->> 'endOffset')::numeric
      or (item_payload ->> 'startOffset')::numeric not between 0 and 100000
      or (item_payload ->> 'endOffset')::numeric not between 1 and 100000
      or (item_payload ->> 'endOffset')::numeric <= (item_payload ->> 'startOffset')::numeric then
      return false;
    end if;
  elsif item_kind = 'video' then
    if item_payload ->> 'canonicalUrl' <> 'https://www.youtube.com/watch?v=' || item_youtube_video_id
      or item_payload ->> 'thumbnailUrl' <> 'https://i.ytimg.com/vi/' || item_youtube_video_id || '/hqdefault.jpg'
      or length(item_payload ->> 'title') > 300
      or length(item_payload ->> 'channel') > 200
      or jsonb_typeof(item_payload -> 'description') <> 'string'
      or length(item_payload ->> 'description') > 5000
      or jsonb_typeof(item_payload -> 'durationSeconds') <> 'number'
      or (item_payload ->> 'durationSeconds')::numeric not between 0 and 604800
      or item_payload -> 'requestNativeSnapshot' <> 'true'::jsonb then
      return false;
    end if;
  end if;

  if item_kind in ('subtitle_row','subtitle_selection')
    and length(item_payload ->> 'originalChinese') > 10000 then
    return false;
  end if;
  if item_kind = 'key_quote' and length(item_payload ->> 'exactQuote') > 10000 then
    return false;
  end if;
  if item_kind = 'ai_explanation'
    and (length(item_payload ->> 'selectedChinese') > 10000
      or length(item_payload ->> 'englishExplanation') > 10000) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end
$$;

revoke all on function private.is_valid_saved_item_payload(text, jsonb, numeric, text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_valid_saved_item_payload(text, jsonb, numeric, text)
  to authenticated, service_role;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  native_language text not null default 'en',
  target_language text not null default 'zh-CN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint language_pair_check check (native_language = 'en' and target_language = 'zh-CN')
);

create table public.video_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  youtube_video_id text not null,
  canonical_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_source_owner_key unique (id, user_id),
  constraint video_source_owner_video_key unique (id, user_id, youtube_video_id),
  constraint youtube_video_id_check check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint canonical_youtube_url_check check (
    canonical_url = 'https://www.youtube.com/watch?v=' || youtube_video_id
    and length(canonical_url) <= 200
  )
);

create unique index video_sources_user_video_unique
  on public.video_sources (user_id, youtube_video_id);

create table public.video_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  title text not null,
  channel text not null,
  thumbnail_url text not null,
  duration_seconds numeric not null,
  description text not null default '',
  transcript_language text not null,
  transcript_hash text not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint video_snapshot_owner_key unique (id, user_id),
  constraint video_snapshot_owner_source_key unique (id, user_id, video_source_id),
  constraint video_snapshot_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint video_snapshot_text_check check (
    length(btrim(title)) between 1 and 300
    and length(btrim(channel)) between 1 and 200
    and length(description) <= 5000
  ),
  constraint video_snapshot_thumbnail_check check (
    thumbnail_url ~ '^https://i[.]ytimg[.]com/vi/[A-Za-z0-9_-]{11}/hqdefault[.]jpg$'
  ),
  constraint video_snapshot_duration_check check (duration_seconds between 0 and 604800),
  constraint transcript_language_check check (transcript_language = 'zh-CN'),
  constraint transcript_hash_shape_check check (transcript_hash ~ '^[a-f0-9]{64}$')
);

create unique index video_snapshots_source_hash_unique
  on public.video_snapshots (video_source_id, transcript_hash);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  snapshot_id uuid not null,
  stable_id text not null,
  position integer not null,
  original_chinese text not null,
  english_translation text,
  start_seconds numeric not null,
  end_seconds numeric not null,
  language text not null,
  created_at timestamptz not null default now(),
  constraint transcript_segment_owner_key unique (id, user_id),
  constraint transcript_segment_snapshot_owner_fk foreign key (snapshot_id, user_id)
    references public.video_snapshots(id, user_id) on delete restrict,
  constraint transcript_segment_stable_id_check check (
    length(stable_id) between 1 and 200 and stable_id = btrim(stable_id)
  ),
  constraint transcript_segment_position_check check (position between 0 and 100000),
  constraint transcript_segment_text_check check (
    private.is_target_chinese(original_chinese, 10000)
    and (english_translation is null or private.is_basic_latin_english(english_translation, 10000))
  ),
  constraint transcript_segment_time_check check (
    start_seconds between 0 and 604800
    and end_seconds between start_seconds and 604800
  ),
  constraint transcript_segment_language_check check (language = 'zh-CN')
);

create unique index transcript_segments_snapshot_stable_unique
  on public.transcript_segments (snapshot_id, stable_id);

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  snapshot_id uuid,
  client_event_id uuid not null,
  youtube_video_id text not null,
  kind text not null,
  status text not null,
  captured_at timestamptz not null,
  start_seconds numeric,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_item_owner_key unique (id, user_id),
  constraint saved_item_owner_source_key unique (id, user_id, video_source_id),
  constraint saved_item_owner_source_snapshot_key unique (id, user_id, video_source_id, snapshot_id),
  constraint saved_item_source_owner_fk foreign key (video_source_id, user_id, youtube_video_id)
    references public.video_sources(id, user_id, youtube_video_id) on delete restrict,
  constraint saved_item_snapshot_owner_fk foreign key (snapshot_id, user_id, video_source_id)
    references public.video_snapshots(id, user_id, video_source_id) on delete restrict,
  constraint saved_item_kind_check check (kind in (
    'video', 'player_moment', 'subtitle_row', 'subtitle_selection', 'key_quote', 'ai_explanation'
  )),
  constraint saved_item_status_check check (status in (
    'saved', 'resolving_source', 'organizing', 'ready', 'unsupported', 'failed'
  )),
  constraint saved_item_payload_check check (
    private.is_valid_saved_item_payload(kind, payload, start_seconds, youtube_video_id)
  ),
  constraint saved_item_start_check check (start_seconds between 0 and 604800)
);

create unique index saved_items_user_event_unique
  on public.saved_items (user_id, client_event_id);
create index saved_items_user_source_start_idx
  on public.saved_items (user_id, video_source_id, start_seconds);

create table public.generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  saved_item_id uuid,
  artifact_type text not null,
  native_language text not null,
  target_language text not null,
  content jsonb not null,
  prompt_version text not null,
  model text not null,
  result_key text not null,
  created_at timestamptz not null default now(),
  constraint generated_artifact_owner_key unique (id, user_id),
  constraint generated_artifact_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint generated_artifact_save_owner_fk foreign key (saved_item_id, user_id, video_source_id)
    references public.saved_items(id, user_id, video_source_id) on delete restrict,
  constraint artifact_type_check check (artifact_type in (
    'overview', 'chapters', 'key_quotes', 'segment_translation', 'selection_explanation', 'saved_item_analysis'
  )),
  constraint generated_artifact_language_check check (native_language = 'en' and target_language = 'zh-CN'),
  constraint generated_artifact_content_check check (jsonb_typeof(content) = 'object'),
  constraint generated_artifact_metadata_check check (
    length(btrim(prompt_version)) between 1 and 100 and length(btrim(model)) between 1 and 100
  ),
  constraint hash_shape_check check (result_key ~ '^[a-f0-9]{64}$')
);

create unique index generated_artifacts_user_result_unique
  on public.generated_artifacts (user_id, artifact_type, result_key);

create table public.knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  saved_item_id uuid,
  job_type text not null,
  status text not null default 'pending',
  dedupe_key text not null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_job_owner_key unique (id, user_id),
  constraint knowledge_job_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint knowledge_job_save_owner_fk foreign key (saved_item_id, user_id, video_source_id)
    references public.saved_items(id, user_id, video_source_id) on delete restrict,
  constraint knowledge_job_status_check check (status in (
    'pending', 'leased', 'succeeded', 'retryable_failed', 'terminal_failed'
  )),
  constraint knowledge_job_type_check check (job_type in (
    'resolve_snapshot', 'generate_overview', 'translate_segments',
    'explain_selection', 'analyze_saved_item'
  )),
  constraint knowledge_job_dedupe_hash_check check (dedupe_key ~ '^[a-f0-9]{64}$'),
  constraint knowledge_job_attempt_check check (attempt_count between 0 and 20),
  constraint knowledge_job_error_code_check check (
    last_error_code is null or length(btrim(last_error_code)) between 1 and 100
  ),
  constraint knowledge_job_lifecycle_check check (
    (status = 'pending' and next_attempt_at is null and lease_expires_at is null and last_error_code is null)
    or (status = 'leased' and next_attempt_at is null and lease_expires_at is not null and last_error_code is null)
    or (status = 'retryable_failed' and next_attempt_at is not null and lease_expires_at is null and last_error_code is not null)
    or (status = 'succeeded' and next_attempt_at is null and lease_expires_at is null and last_error_code is null)
    or (status = 'terminal_failed' and next_attempt_at is null and lease_expires_at is null and last_error_code is not null)
  )
);

create unique index knowledge_jobs_user_dedupe_unique
  on public.knowledge_jobs (user_id, job_type, dedupe_key);
create index knowledge_jobs_lease_scan_idx
  on public.knowledge_jobs (status, next_attempt_at, lease_expires_at);

create table public.expression_senses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  saved_item_id uuid,
  expression_text text not null,
  normalized_expression_text text not null,
  english_meaning text not null,
  english_explanation text not null,
  tone text not null,
  communicative_function text not null,
  register text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expression_sense_owner_key unique (id, user_id),
  constraint expression_sense_owner_source_key unique (id, user_id, video_source_id),
  constraint expression_sense_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint expression_sense_save_owner_fk foreign key (saved_item_id, user_id, video_source_id)
    references public.saved_items(id, user_id, video_source_id) on delete restrict,
  constraint expression_sense_text_check check (
    private.is_target_chinese(expression_text, 200)
    and private.is_target_chinese(normalized_expression_text, 200)
    and private.is_basic_latin_english(english_meaning, 500)
    and private.is_basic_latin_english(english_explanation, 2000)
    and private.is_basic_latin_english(tone, 200)
    and private.is_basic_latin_english(communicative_function, 300)
    and private.is_basic_latin_english(register, 200)
  )
);

create index expression_senses_normalized_text_idx
  on public.expression_senses (user_id, normalized_expression_text);
create index expression_senses_expression_trgm_idx
  on public.expression_senses using gin (expression_text extensions.gin_trgm_ops);

create table public.expression_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  expression_sense_id uuid not null,
  snapshot_id uuid not null,
  saved_item_id uuid not null,
  evidence_text text not null,
  segment_ids text[] not null,
  start_seconds numeric not null,
  end_seconds numeric not null,
  confidence numeric not null,
  created_at timestamptz not null default now(),
  constraint expression_occurrence_owner_key unique (id, user_id),
  constraint expression_occurrence_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint expression_occurrence_sense_owner_fk foreign key (expression_sense_id, user_id, video_source_id)
    references public.expression_senses(id, user_id, video_source_id) on delete restrict,
  constraint expression_occurrence_snapshot_owner_fk foreign key (snapshot_id, user_id, video_source_id)
    references public.video_snapshots(id, user_id, video_source_id) on delete restrict,
  constraint expression_occurrence_save_owner_fk foreign key (saved_item_id, user_id, video_source_id, snapshot_id)
    references public.saved_items(id, user_id, video_source_id, snapshot_id) on delete restrict,
  constraint expression_occurrence_evidence_check check (private.is_target_chinese(evidence_text, 2000)),
  constraint expression_occurrence_segments_check check (private.are_valid_stable_segment_ids(segment_ids)),
  constraint expression_occurrence_time_check check (
    start_seconds between 0 and 604800 and end_seconds between start_seconds and 604800
  ),
  constraint expression_occurrence_confidence_check check (confidence between 0 and 1)
);

create function private.validate_expression_occurrence_segments()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if cardinality(new.segment_ids) <> (
    select count(distinct supplied.stable_id)::integer
    from unnest(new.segment_ids) as supplied(stable_id)
  ) then
    raise exception using
      errcode = '23514',
      message = 'expression occurrence segment_ids must not contain duplicates';
  end if;

  if exists (
    select 1
    from unnest(new.segment_ids) as supplied(stable_id)
    where not exists (
      select 1
      from public.transcript_segments as segment
      where segment.user_id = new.user_id
        and segment.snapshot_id = new.snapshot_id
        and segment.stable_id = supplied.stable_id
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'expression occurrence segment_ids must exist in the owned snapshot';
  end if;

  return new;
end
$$;

revoke all on function private.validate_expression_occurrence_segments() from public;

create trigger expression_occurrence_segments_validate
before insert or update of user_id, snapshot_id, segment_ids
on public.expression_occurrences
for each row execute function private.validate_expression_occurrence_segments();

create table public.user_expressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  expression_sense_id uuid not null,
  mastery_state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_expression_owner_key unique (id, user_id),
  constraint user_expression_sense_owner_fk foreign key (expression_sense_id, user_id)
    references public.expression_senses(id, user_id) on delete restrict,
  constraint user_expression_sense_unique unique (user_id, expression_sense_id),
  constraint mastery_state_check check (mastery_state in ('tried', 'reused', 'owned'))
);

create table public.practice_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  user_expression_id uuid not null,
  kind text not null,
  native_language text not null,
  target_language text not null,
  target_expression text not null,
  prompt_chinese text not null,
  instructions_english text not null,
  goal_english text not null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  constraint practice_task_owner_key unique (id, user_id),
  constraint practice_task_owner_expression_key unique (id, user_id, user_expression_id),
  constraint practice_task_expression_owner_fk foreign key (user_expression_id, user_id)
    references public.user_expressions(id, user_id) on delete restrict,
  constraint practice_task_kind_check check (kind in ('use_it_now', 'due_practice')),
  constraint practice_task_language_check check (native_language = 'en' and target_language = 'zh-CN'),
  constraint practice_task_text_check check (
    private.is_target_chinese(target_expression, 200)
    and private.is_target_chinese(prompt_chinese, 2000)
    and private.is_basic_latin_english(instructions_english, 1000)
    and private.is_basic_latin_english(goal_english, 1000)
  ),
  constraint practice_task_due_check check (
    (kind = 'use_it_now' and due_at is null) or (kind = 'due_practice' and due_at is not null)
  )
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  practice_task_id uuid not null,
  user_expression_id uuid not null,
  response_chinese text not null,
  passed boolean not null,
  accuracy_score integer not null,
  accuracy_feedback_english text not null,
  naturalness_score integer not null,
  naturalness_feedback_english text not null,
  contextual_fit_score integer not null,
  contextual_fit_feedback_english text not null,
  independent_use boolean not null,
  assistance_level text not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint attempt_owner_key unique (id, user_id),
  constraint attempt_owner_expression_key unique (id, user_id, user_expression_id),
  constraint attempt_task_owner_fk foreign key (practice_task_id, user_id, user_expression_id)
    references public.practice_tasks(id, user_id, user_expression_id) on delete restrict,
  constraint attempt_expression_owner_fk foreign key (user_expression_id, user_id)
    references public.user_expressions(id, user_id) on delete restrict,
  constraint attempt_response_check check (private.is_target_chinese(response_chinese, 5000)),
  constraint attempt_score_check check (
    accuracy_score between 1 and 5 and naturalness_score between 1 and 5
    and contextual_fit_score between 1 and 5
  ),
  constraint attempt_feedback_check check (
    private.is_basic_latin_english(accuracy_feedback_english, 2000)
    and private.is_basic_latin_english(naturalness_feedback_english, 2000)
    and private.is_basic_latin_english(contextual_fit_feedback_english, 2000)
  ),
  constraint attempt_assistance_check check (assistance_level in ('none', 'hint', 'model_answer')),
  constraint attempt_independent_check check (not independent_use or assistance_level = 'none')
);

create table public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  user_expression_id uuid not null,
  attempt_id uuid,
  prior_state text,
  new_state text not null,
  evidence_kind text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint mastery_event_owner_key unique (id, user_id),
  constraint mastery_event_expression_owner_fk foreign key (user_expression_id, user_id)
    references public.user_expressions(id, user_id) on delete restrict,
  constraint mastery_event_attempt_owner_fk foreign key (attempt_id, user_id, user_expression_id)
    references public.attempts(id, user_id, user_expression_id) on delete restrict,
  constraint mastery_event_prior_state_check check (prior_state is null or prior_state in ('tried', 'reused', 'owned')),
  constraint mastery_event_new_state_check check (new_state in ('tried', 'reused', 'owned')),
  constraint mastery_event_evidence_check check (length(btrim(evidence_kind)) between 1 and 100)
);

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  user_expression_id uuid not null,
  mastery_state text not null,
  status text not null,
  due_at timestamptz not null,
  interval_days integer not null,
  consecutive_successes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_task_owner_key unique (id, user_id),
  constraint review_task_expression_owner_fk foreign key (user_expression_id, user_id)
    references public.user_expressions(id, user_id) on delete restrict,
  constraint review_task_mastery_check check (mastery_state in ('tried', 'reused', 'owned')),
  constraint review_task_status_check check (status in ('pending', 'completed', 'cancelled')),
  constraint review_task_interval_check check (interval_days between 1 and 365),
  constraint review_task_successes_check check (consecutive_successes between 0 and 1000)
);

create index review_tasks_user_due_status_idx
  on public.review_tasks (user_id, due_at, status);

comment on column public.knowledge_jobs.last_error_code is
  'Bounded worker error category/code. Service-role workers must still scope every query by user_id.';
comment on column public.generated_artifacts.result_key is
  'SHA-256 of source or saved-item identity plus payload, prompt version, and model inputs.';
comment on column public.knowledge_jobs.dedupe_key is
  'SHA-256 of job type plus source, payload, prompt version, and model inputs.';
