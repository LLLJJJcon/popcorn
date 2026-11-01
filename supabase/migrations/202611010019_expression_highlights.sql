-- Editable UTF-16 expression marks are independent of immutable learning cards.
alter table public.saved_items add column highlight_status text
  check (highlight_status in ('pending','ready','unavailable'));
alter table public.knowledge_jobs drop constraint knowledge_job_type_check;
alter table public.knowledge_jobs add constraint knowledge_job_type_check check (job_type in (
  'resolve_snapshot','generate_overview','translate_segments','explain_selection','analyze_saved_item','highlight_saved_item'
));
create table public.saved_item_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  saved_item_id uuid not null,
  start_segment_id text not null,
  start_offset integer not null check (start_offset >= 0),
  end_segment_id text not null,
  end_offset integer not null check (end_offset >= 0),
  text text not null check (length(text) between 1 and 10000),
  origin text not null check (origin in ('model','user')),
  reason_en text,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint saved_item_highlight_owner_fk foreign key (saved_item_id,user_id)
    references public.saved_items(id,user_id) on delete cascade,
  constraint saved_item_highlight_removed_check check ((status='active' and removed_at is null) or (status='removed' and removed_at is not null))
);
create unique index saved_item_highlight_active_position on public.saved_item_highlights
  (saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset) where status='active';
create index saved_item_highlight_owner_idx on public.saved_item_highlights(user_id,saved_item_id,status);
alter table public.saved_item_highlights enable row level security;
create policy saved_item_highlights_owner on public.saved_item_highlights for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.saved_item_highlights to authenticated,service_role;

-- Existing clients may still send three after-lines; resolution always rewrites to two.
create or replace function private.is_valid_saved_item_payload(
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
      allowed_keys := required_keys || array['resolvedSegmentId','originalChinese','startSeconds','endSeconds','contextBefore','contextAfter'];
      if item_payload ? 'resolvedSegmentId' then
        required_keys := required_keys || array['resolvedSegmentId','originalChinese','startSeconds','endSeconds','contextBefore','contextAfter'];
        plain_text_keys := array['resolvedSegmentId'];
        chinese_text_keys := array['originalChinese'];
        context_keys := array['contextBefore','contextAfter'];
      end if;
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
      allowed_keys := required_keys || array['contextBefore','contextAfter'];
      context_keys := array(select k from unnest(array['contextBefore','contextAfter']) k where item_payload ? k);
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

  if item_kind = 'player_moment' and item_payload ? 'resolvedSegmentId' then
    if length(item_payload->>'resolvedSegmentId') not between 1 and 200
      or jsonb_typeof(item_payload->'startSeconds') <> 'number'
      or jsonb_typeof(item_payload->'endSeconds') <> 'number'
      or (item_payload->>'startSeconds')::numeric not between 0 and 604800
      or (item_payload->>'endSeconds')::numeric not between (item_payload->>'startSeconds')::numeric and 604800 then return false; end if;
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


-- JS and DOM offsets count UTF-16 code units; PostgreSQL counts code points.
create function private.utf16_length(p_text text) returns integer language sql immutable strict
set search_path=pg_catalog as $$
 select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)::integer
 from regexp_split_to_table(p_text,'') as ch where ch<>''
$$;
create function private.utf16_slice(p_text text,p_start integer,p_end integer) returns text
language plpgsql immutable strict set search_path=pg_catalog as $$
declare v_result text:=''; v_offset integer:=0; v_char text; v_size integer;
begin
 if p_start<0 or p_end<p_start then raise exception 'Invalid UTF-16 range'; end if;
 foreach v_char in array regexp_split_to_array(p_text,'') loop
  v_size:=case when ascii(v_char)>65535 then 2 else 1 end;
  if (p_start>v_offset and p_start<v_offset+v_size) or (p_end>v_offset and p_end<v_offset+v_size) then raise exception 'Split Unicode character'; end if;
  if v_offset>=p_start and v_offset+v_size<=p_end then v_result:=v_result||v_char; end if;
  v_offset:=v_offset+v_size;
 end loop;
 if p_end>v_offset then raise exception 'Invalid UTF-16 offset'; end if;
 return v_result;
end $$;
revoke all on function private.utf16_length(text),private.utf16_slice(text,integer,integer) from public,anon,authenticated;

create or replace function public.register_learning_artifact_job(
  p_user_id uuid,
  p_video_source_id uuid,
  p_job_type text,
  p_dedupe_key text,
  p_input jsonb,
  p_now timestamptz
)
returns table (
  knowledge_job_id uuid,
  status text,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job_id uuid;
  v_status text;
  v_source_id uuid;
  v_saved_item_id uuid;
  v_requested_saved_item_id uuid;
  v_created boolean := false;
begin
  if p_user_id is null
    or p_video_source_id is null
    or p_job_type is null
    or p_job_type not in (
      'generate_overview', 'translate_segments', 'explain_selection',
      'analyze_saved_item', 'highlight_saved_item'
    )
    or p_dedupe_key is null
    or p_dedupe_key !~ '^[a-f0-9]{64}$'
    or p_input is null
    or jsonb_typeof(p_input) <> 'object'
    or octet_length(convert_to(p_input::text, 'UTF8')) > 65536
    or p_now is null
    or not isfinite(p_now) then
    raise exception using
      errcode = '22023',
      message = 'invalid learning-artifact registration input';
  end if;

  if not exists (
    select 1
    from public.video_sources as source
    where source.id = p_video_source_id
      and source.user_id = p_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'video source does not belong to expected user';
  end if;

  if p_job_type in ('analyze_saved_item','highlight_saved_item') then
    if jsonb_typeof(p_input -> 'savedItemId') <> 'string'
      or (p_input ->> 'savedItemId') !~
        '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
      raise exception using
        errcode = '22023',
        message = 'saved-item analysis requires a canonical saved item id';
    end if;

    v_requested_saved_item_id := (p_input ->> 'savedItemId')::uuid;

    if not exists (
      select 1
      from public.saved_items as item
      where item.id = v_requested_saved_item_id
        and item.user_id = p_user_id
        and item.video_source_id = p_video_source_id
    ) then
      raise exception using
        errcode = '22023',
        message = 'saved item does not belong to expected user and source';
    end if;
  end if;

  insert into public.knowledge_jobs as job (
    user_id,
    video_source_id,
    saved_item_id,
    job_type,
    status,
    dedupe_key,
    attempt_count,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_video_source_id,
    v_requested_saved_item_id,
    p_job_type,
    'pending',
    p_dedupe_key,
    0,
    p_now,
    p_now
  )
  on conflict (user_id, job_type, dedupe_key) do nothing
  returning job.id, job.status, job.video_source_id, job.saved_item_id
  into v_job_id, v_status, v_source_id, v_saved_item_id;

  if found then
    v_created := true;

    insert into public.knowledge_job_internal (
      knowledge_job_id,
      user_id,
      input,
      result,
      created_at,
      updated_at
    ) values (
      v_job_id,
      p_user_id,
      p_input,
      null,
      p_now,
      p_now
    );
  else
    select job.id, job.status, job.video_source_id, job.saved_item_id
    into strict v_job_id, v_status, v_source_id, v_saved_item_id
    from public.knowledge_jobs as job
    where job.user_id = p_user_id
      and job.job_type = p_job_type
      and job.dedupe_key = p_dedupe_key;

    if v_source_id <> p_video_source_id
      or v_saved_item_id is distinct from v_requested_saved_item_id then
      raise exception using
        errcode = '22023',
        message = 'dedupe key belongs to a different learning-artifact source';
    end if;
  end if;

  return query select v_job_id, v_status, v_created;
end
$$;

create or replace function public.transition_learning_artifact_failure(
  p_user_id uuid,
  p_job_id uuid,
  p_video_source_id uuid,
  p_job_type text,
  p_expected_lease_expires_at timestamptz,
  p_expected_attempt_count integer,
  p_target_status text,
  p_next_attempt_at timestamptz,
  p_error_code text,
  p_clear_input boolean,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job_id uuid;
begin
  if p_user_id is null
    or p_job_id is null
    or p_video_source_id is null
    or p_job_type is null
    or p_job_type not in (
      'generate_overview', 'translate_segments', 'explain_selection',
      'analyze_saved_item', 'highlight_saved_item'
    )
    or p_expected_lease_expires_at is null
    or not isfinite(p_expected_lease_expires_at)
    or p_expected_attempt_count is null
    or p_expected_attempt_count not between 1 and 5
    or p_target_status is null
    or p_error_code is null
    or length(p_error_code) not between 1 and 100
    or p_error_code <> btrim(p_error_code)
    or p_clear_input is null
    or p_now is null
    or not isfinite(p_now)
    or p_expected_lease_expires_at <= p_now then
    raise exception using
      errcode = '22023',
      message = 'invalid learning-artifact failure transition input';
  end if;

  if p_target_status = 'retryable_failed' then
    if p_expected_attempt_count >= 5
      or p_next_attempt_at is null
      or not isfinite(p_next_attempt_at)
      or p_next_attempt_at <> p_now
        + power(2, p_expected_attempt_count - 1) * interval '1 minute'
      or p_clear_input then
      raise exception using
        errcode = '22023',
        message = 'retryable failure requires attempts one through four and exact backoff';
    end if;
  elsif p_target_status = 'terminal_failed' then
    if p_next_attempt_at is not null or not p_clear_input then
      raise exception using
        errcode = '22023',
        message = 'terminal failure requires private input clearing and no retry clock';
    end if;
  else
    raise exception using
      errcode = '22023',
      message = 'failure target must be retryable_failed or terminal_failed';
  end if;

  select job.id
  into v_job_id
  from public.knowledge_jobs as job
  join public.knowledge_job_internal as internal
    on internal.knowledge_job_id = job.id
   and internal.user_id = job.user_id
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.video_source_id = p_video_source_id
    and (
      (p_job_type in ('analyze_saved_item','highlight_saved_item') and job.saved_item_id is not null)
      or (p_job_type not in ('analyze_saved_item','highlight_saved_item') and job.saved_item_id is null)
    )
    and job.job_type = p_job_type
    and job.status = 'leased'
    and job.lease_expires_at = p_expected_lease_expires_at
    and job.attempt_count = p_expected_attempt_count
  for update of job, internal;

  if not found then
    return false;
  end if;

  update public.knowledge_jobs as job
  set
    status = p_target_status,
    next_attempt_at = p_next_attempt_at,
    lease_expires_at = null,
    last_error_code = p_error_code,
    updated_at = p_now
  where job.id = v_job_id
    and job.user_id = p_user_id;

  if p_clear_input then
    update public.knowledge_job_internal as internal
    set
      input = '{}'::jsonb,
      updated_at = p_now
    where internal.knowledge_job_id = v_job_id
      and internal.user_id = p_user_id;
  end if;

  return true;
end
$$;


-- Mutations serialize on the save: overlap replacement and undo are atomic.
create function public.mutate_saved_item_highlight(
 p_user_id uuid,p_saved_item_id uuid,p_action text,p_highlight_id uuid,
 p_start_segment_id text,p_start_offset integer,p_end_segment_id text,p_end_offset integer,p_text text,p_now timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_item public.saved_items%rowtype; v_mark public.saved_item_highlights%rowtype;
 v_start integer; v_end integer; v_part text; v_expected text:=''; v_row record; v_first boolean:=true;
 v_ids text[]; v_capture numeric;
begin
 if p_user_id is null or p_saved_item_id is null or p_now is null or not isfinite(p_now) or p_action is null or p_action not in ('add','remove','restore') then raise exception 'Invalid highlight mutation'; end if;
 select * into v_item from public.saved_items where id=p_saved_item_id and user_id=p_user_id and removed_from_saved_at is null for update;
 if not found or v_item.status<>'ready' or v_item.snapshot_id is null then return false; end if;
 if p_action in ('remove','restore') then
  select * into v_mark from public.saved_item_highlights where id=p_highlight_id and user_id=p_user_id and saved_item_id=p_saved_item_id for update;
  if not found then return false; end if;
  if p_action='remove' then
   update public.saved_item_highlights set status='removed',removed_at=p_now where id=v_mark.id and status='active';
   return true;
  end if;
  if v_mark.status<>'removed' or v_mark.removed_at<p_now-interval '5 seconds' then return false; end if;
  p_start_segment_id:=v_mark.start_segment_id; p_start_offset:=v_mark.start_offset;
  p_end_segment_id:=v_mark.end_segment_id; p_end_offset:=v_mark.end_offset; p_text:=v_mark.text;
 end if;
 if v_item.kind='player_moment' then
  -- Old ready saves have only capturedSecond. Compute the same authoritative
  -- target without changing their payload: covering line, previous line, first.
  v_capture:=coalesce((v_item.payload->>'capturedSecond')::numeric,v_item.start_seconds,0);
  select array[s.stable_id] into v_ids from public.transcript_segments s
  where s.snapshot_id=v_item.snapshot_id and s.user_id=p_user_id
  order by case when s.start_seconds<=v_capture and v_capture<s.end_seconds then 0 when s.start_seconds<=v_capture then 1 else 2 end,
   case when s.start_seconds<=v_capture and v_capture>=s.end_seconds then -s.position else s.position end
  limit 1;
 else
  v_ids:=case when v_item.kind='subtitle_row' then array[v_item.payload->>'segmentId'] else array(select jsonb_array_elements_text(coalesce(v_item.payload->'segmentIds','[]'::jsonb))) end;
 end if;
 v_ids:=array_remove(v_ids,null);
 if coalesce(cardinality(v_ids),0)=0 or not coalesce(p_start_segment_id=any(v_ids) and p_end_segment_id=any(v_ids),false) then raise exception 'Selection must stay in saved target lines'; end if;
 select position into v_start from public.transcript_segments where snapshot_id=v_item.snapshot_id and user_id=p_user_id and stable_id=p_start_segment_id;
 select position into v_end from public.transcript_segments where snapshot_id=v_item.snapshot_id and user_id=p_user_id and stable_id=p_end_segment_id;
 if v_start is null or v_end is null or v_end<v_start or p_start_offset is null or p_end_offset is null or p_start_offset<0 or p_end_offset<0 then raise exception 'Invalid highlight range'; end if;
 for v_row in select * from public.transcript_segments where snapshot_id=v_item.snapshot_id and user_id=p_user_id and position between v_start and v_end order by position loop
  if not coalesce(v_row.stable_id=any(v_ids),false) then raise exception 'Selection cannot include context lines'; end if;
  v_part:=private.utf16_slice(v_row.original_chinese,case when v_row.position=v_start then p_start_offset else 0 end,case when v_row.position=v_end then p_end_offset else private.utf16_length(v_row.original_chinese) end);
  v_expected:=v_expected||case when v_first then '' else E'\n' end||v_part; v_first:=false;
 end loop;
 if v_expected<>p_text or p_text is null or length(p_text)=0 then raise exception 'Highlight text does not match persisted transcript'; end if;
 if p_action='restore' and exists (
  select 1 from public.saved_item_highlights h
  join public.transcript_segments hs on hs.snapshot_id=v_item.snapshot_id and hs.user_id=p_user_id and hs.stable_id=h.start_segment_id
  join public.transcript_segments he on he.snapshot_id=v_item.snapshot_id and he.user_id=p_user_id and he.stable_id=h.end_segment_id
  where h.saved_item_id=p_saved_item_id and h.user_id=p_user_id and h.status='active'
   and (hs.position,h.start_offset)<(v_end,p_end_offset) and (v_start,p_start_offset)<(he.position,h.end_offset)
 ) then return false; end if;
 if p_action='add' then
  update public.saved_item_highlights h set status='removed',removed_at=p_now
  from public.transcript_segments hs,public.transcript_segments he
  where h.saved_item_id=p_saved_item_id and h.user_id=p_user_id and h.status='active'
   and hs.snapshot_id=v_item.snapshot_id and hs.user_id=p_user_id and hs.stable_id=h.start_segment_id
   and he.snapshot_id=v_item.snapshot_id and he.user_id=p_user_id and he.stable_id=h.end_segment_id
   and (hs.position,h.start_offset)<(v_end,p_end_offset) and (v_start,p_start_offset)<(he.position,h.end_offset);
  insert into public.saved_item_highlights(user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin,created_at)
  values(p_user_id,p_saved_item_id,p_start_segment_id,p_start_offset,p_end_segment_id,p_end_offset,p_text,'user',p_now);
 else update public.saved_item_highlights set status='active',removed_at=null where id=v_mark.id;
 end if;
 return true;
end $$;
revoke all on function public.mutate_saved_item_highlight(uuid,uuid,text,uuid,text,integer,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mutate_saved_item_highlight(uuid,uuid,text,uuid,text,integer,text,integer,text,timestamptz) to service_role;

create function public.complete_saved_item_highlights(
 p_user_id uuid,p_job_id uuid,p_expected_lease_expires_at timestamptz,p_expected_attempt_count integer,p_highlights jsonb,p_unavailable boolean,p_now timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.knowledge_jobs%rowtype; v_item public.saved_items%rowtype; v_value jsonb;
 v_start integer; v_end integer;
begin
 if p_user_id is null or p_job_id is null or p_now is null or not isfinite(p_now) or p_expected_lease_expires_at is null or p_expected_attempt_count is null or p_expected_attempt_count not between 1 and 5 or p_unavailable is null or p_highlights is null or p_expected_lease_expires_at<=p_now or jsonb_typeof(p_highlights)<>'array' or jsonb_array_length(p_highlights)>2 then raise exception 'Invalid highlight job result'; end if;
 select * into v_job from public.knowledge_jobs where id=p_job_id and user_id=p_user_id and job_type='highlight_saved_item' and status='leased' and lease_expires_at=p_expected_lease_expires_at and attempt_count=p_expected_attempt_count for update;
 if not found then return false; end if;
 select * into v_item from public.saved_items where id=v_job.saved_item_id and user_id=p_user_id and video_source_id=v_job.video_source_id for update;
 if not found then return false; end if;
 if v_item.removed_from_saved_at is not null then
  update public.knowledge_jobs set status='terminal_failed',lease_expires_at=null,next_attempt_at=null,last_error_code='SAVED_ITEM_REMOVED',updated_at=p_now where id=v_job.id;
  update public.knowledge_job_internal set input='{}'::jsonb,result=null,updated_at=p_now where knowledge_job_id=v_job.id and user_id=p_user_id;
  return true;
 end if;
 if not p_unavailable and not exists (
  select 1 from private.learning_artifact_gateway_pins pin
  join public.resolve_active_user_model_gateway_pin(p_user_id) config on config.config_id=pin.config_id and config.revision=pin.config_revision and config.config_fingerprint=pin.config_fingerprint
  where pin.knowledge_job_id=p_job_id and pin.user_id=p_user_id
 ) then p_unavailable:=true; end if;
 if not p_unavailable then
  for v_value in select value from jsonb_array_elements(p_highlights) loop
   select position into v_start from public.transcript_segments where snapshot_id=v_item.snapshot_id and user_id=p_user_id and stable_id=v_value->>'startSegmentId';
   select position into v_end from public.transcript_segments where snapshot_id=v_item.snapshot_id and user_id=p_user_id and stable_id=v_value->>'endSegmentId';
   if v_start is null or v_end is null then raise exception 'Unknown highlight target'; end if;
   -- User edits and removed marks win over late suggestions and retries.
   if not exists (
    select 1 from public.saved_item_highlights h
    join public.transcript_segments hs on hs.snapshot_id=v_item.snapshot_id and hs.user_id=p_user_id and hs.stable_id=h.start_segment_id
    join public.transcript_segments he on he.snapshot_id=v_item.snapshot_id and he.user_id=p_user_id and he.stable_id=h.end_segment_id
    where h.saved_item_id=v_item.id and h.user_id=p_user_id
     and (hs.position,h.start_offset)<(v_end,(v_value->>'endOffset')::integer)
     and (v_start,(v_value->>'startOffset')::integer)<(he.position,h.end_offset)
   ) then
    insert into public.saved_item_highlights(user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin,reason_en,created_at)
    values(p_user_id,v_item.id,v_value->>'startSegmentId',(v_value->>'startOffset')::integer,v_value->>'endSegmentId',(v_value->>'endOffset')::integer,v_value->>'text','model',v_value->>'reasonEn',p_now)
    on conflict do nothing;
   end if;
  end loop;
 end if;
 update public.saved_items set highlight_status=case when p_unavailable then 'unavailable' else 'ready' end,updated_at=p_now where id=v_item.id and user_id=p_user_id;
 update public.knowledge_jobs set status=case when p_unavailable then 'terminal_failed' else 'succeeded' end,lease_expires_at=null,next_attempt_at=null,last_error_code=case when p_unavailable then 'PROVIDER_OUTPUT_INVALID' else null end,updated_at=p_now where id=v_job.id;
 update public.knowledge_job_internal set input='{}'::jsonb,result=null,updated_at=p_now where knowledge_job_id=v_job.id and user_id=p_user_id;
 return true;
end $$;
revoke all on function public.complete_saved_item_highlights(uuid,uuid,timestamptz,integer,jsonb,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.complete_saved_item_highlights(uuid,uuid,timestamptz,integer,jsonb,boolean,timestamptz) to service_role;

-- Resolve saved targets from the immutable snapshot, never from client context.
create function private.prepare_saved_item_learning() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_target record; v_first integer; v_last integer; v_ids text[]; v_context jsonb; v_pin record; v_registration record;
 v_joined text; v_start_offset integer; v_end_offset integer; v_start_id text; v_end_id text; v_selected text;
 v_start_position integer; v_end_position integer; v_char_offset integer; v_row record;
 v_input jsonb; v_key text;
begin
 if new.status<>'ready' or new.snapshot_id is null or new.removed_from_saved_at is not null or new.kind='video' then return new; end if;
 if tg_op='UPDATE' and old.status='ready' and old.snapshot_id is not distinct from new.snapshot_id then return new; end if;
 if new.kind='player_moment' then
  select * into v_target from public.transcript_segments s where s.snapshot_id=new.snapshot_id and s.user_id=new.user_id
  order by case when s.start_seconds<=coalesce((new.payload->>'capturedSecond')::numeric,new.start_seconds,0) and coalesce((new.payload->>'capturedSecond')::numeric,new.start_seconds,0)<s.end_seconds then 0 when s.start_seconds<=coalesce((new.payload->>'capturedSecond')::numeric,new.start_seconds,0) then 1 else 2 end,
   case when s.start_seconds<=coalesce((new.payload->>'capturedSecond')::numeric,new.start_seconds,0) and coalesce((new.payload->>'capturedSecond')::numeric,new.start_seconds,0)>=s.end_seconds then -s.position else s.position end limit 1;
  if not found then new.highlight_status:='unavailable'; return new; end if;
  v_ids:=array[v_target.stable_id];
  new.payload:=new.payload||jsonb_build_object('resolvedSegmentId',v_target.stable_id,'originalChinese',v_target.original_chinese,'startSeconds',v_target.start_seconds,'endSeconds',v_target.end_seconds);
 elsif new.kind='subtitle_row' then v_ids:=array[new.payload->>'segmentId'];
 else v_ids:=array(select jsonb_array_elements_text(coalesce(new.payload->'segmentIds','[]'::jsonb))); end if;
 select min(position),max(position) into v_first,v_last from public.transcript_segments where snapshot_id=new.snapshot_id and user_id=new.user_id and stable_id=any(v_ids);
 if v_first is null or v_last is null then new.highlight_status:='unavailable'; return new; end if;
 select coalesce(jsonb_agg(original_chinese order by position),'[]'::jsonb) into v_context from (select original_chinese,position from public.transcript_segments where snapshot_id=new.snapshot_id and user_id=new.user_id and position<v_first order by position desc limit 3) before_lines;
 new.payload:=new.payload||jsonb_build_object('contextBefore',v_context);
 select coalesce(jsonb_agg(original_chinese order by position),'[]'::jsonb) into v_context from (select original_chinese,position from public.transcript_segments where snapshot_id=new.snapshot_id and user_id=new.user_id and position>v_last order by position limit 2) after_lines;
 new.payload:=new.payload||jsonb_build_object('contextAfter',v_context);
 if new.kind in ('subtitle_selection','ai_explanation') then
  select string_agg(original_chinese,E'\n' order by position) into v_joined from public.transcript_segments where snapshot_id=new.snapshot_id and user_id=new.user_id and stable_id=any(v_ids);
  if new.kind='subtitle_selection' then
   v_start_offset:=(new.payload->>'startOffset')::integer; v_end_offset:=(new.payload->>'endOffset')::integer;
   begin v_selected:=private.utf16_slice(v_joined,v_start_offset,v_end_offset); exception when others then v_selected:=null; end;
  else
   v_selected:=new.payload->>'selectedChinese';
   v_char_offset:=strpos(v_joined,v_selected);
   if v_char_offset>0 then v_start_offset:=private.utf16_length(substr(v_joined,1,v_char_offset-1)); v_end_offset:=v_start_offset+private.utf16_length(v_selected); else v_selected:=null; end if;
  end if;
  if v_selected is not null and length(v_selected)>0 then
   v_char_offset:=0;
   for v_row in select * from public.transcript_segments where snapshot_id=new.snapshot_id and user_id=new.user_id and stable_id=any(v_ids) order by position loop
    if v_start_id is null and v_start_offset<v_char_offset+private.utf16_length(v_row.original_chinese) then v_start_id:=v_row.stable_id; v_start_position:=v_start_offset-v_char_offset; end if;
    if v_end_id is null and v_end_offset<=v_char_offset+private.utf16_length(v_row.original_chinese) then v_end_id:=v_row.stable_id; v_end_position:=v_end_offset-v_char_offset; end if;
    v_char_offset:=v_char_offset+private.utf16_length(v_row.original_chinese)+1;
   end loop;
   if v_start_id is not null and v_end_id is not null then
    insert into public.saved_item_highlights(user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin)
    values(new.user_id,new.id,v_start_id,v_start_position,v_end_id,v_end_position,v_selected,'user') on conflict do nothing;
   end if;
  end if;
  new.highlight_status:='ready';
  return new;
 end if;
 select * into v_pin from public.resolve_active_user_model_gateway_pin(new.user_id);
 if not found then new.highlight_status:='unavailable'; return new; end if;
 v_input:=jsonb_build_object('kind','highlight_saved_item','savedItemId',new.id,'snapshotId',new.snapshot_id,'gatewayConfigId',v_pin.config_id,'gatewayRevision',v_pin.revision,'gatewayFingerprint',v_pin.config_fingerprint);
 v_key:=encode(extensions.digest(convert_to('highlight_saved_item:'||new.id::text||':'||new.snapshot_id::text||':'||v_pin.config_fingerprint,'UTF8'),'sha256'),'hex');
 select * into v_registration from public.register_gateway_learning_artifact_job(new.user_id,new.video_source_id,'highlight_saved_item',v_key,v_input,v_pin.config_id,v_pin.revision,v_pin.config_fingerprint,new.updated_at);
 new.highlight_status:=case when v_registration.status in ('pending','leased') then 'pending' when v_registration.status='succeeded' then 'ready' else 'unavailable' end;
 return new;
end $$;
revoke all on function private.prepare_saved_item_learning() from public,anon,authenticated,service_role;
create trigger prepare_saved_item_learning before update of status,snapshot_id on public.saved_items
 for each row execute function private.prepare_saved_item_learning();

-- Serialize explicit retries so repeated clicks cannot enqueue duplicate work.
create function public.register_saved_item_highlight_suggestion(
 p_user_id uuid,p_saved_item_id uuid,p_dedupe_key text,p_input jsonb,p_config_id uuid,p_expected_config_revision integer,p_expected_config_fingerprint text,p_now timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_item public.saved_items%rowtype;
begin
 select * into v_item from public.saved_items where id=p_saved_item_id and user_id=p_user_id and status='ready' and removed_from_saved_at is null for update;
 if not found or (v_item.highlight_status is not null and v_item.highlight_status<>'unavailable') or v_item.kind='video' or (p_input->>'savedItemId')::uuid<>p_saved_item_id or (p_input->>'snapshotId')::uuid<>v_item.snapshot_id then return false; end if;
 perform * from public.register_gateway_learning_artifact_job(p_user_id,v_item.video_source_id,'highlight_saved_item',p_dedupe_key,p_input,p_config_id,p_expected_config_revision,p_expected_config_fingerprint,p_now);
 update public.saved_items set highlight_status='pending',updated_at=p_now where id=p_saved_item_id and user_id=p_user_id;
 return true;
end $$;
revoke all on function public.register_saved_item_highlight_suggestion(uuid,uuid,text,jsonb,uuid,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.register_saved_item_highlight_suggestion(uuid,uuid,text,jsonb,uuid,integer,text,timestamptz) to service_role;
