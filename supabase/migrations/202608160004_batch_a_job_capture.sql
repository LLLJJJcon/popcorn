create table public.knowledge_job_internal (
  knowledge_job_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_job_internal_owner_fk foreign key (knowledge_job_id, user_id)
    references public.knowledge_jobs(id, user_id) on delete restrict,
  constraint knowledge_job_internal_input_check check (jsonb_typeof(input) = 'object'),
  constraint knowledge_job_internal_result_check check (
    result is null or jsonb_typeof(result) = 'object'
  )
);

alter table public.knowledge_job_internal enable row level security;

-- PostgREST role grants are independent of BYPASSRLS. Server workers need an
-- explicit least-privilege DML surface while every read/mutation remains
-- owner-filtered by repository code and composite ownership constraints.
revoke all on table
  public.profiles,
  public.video_sources,
  public.video_snapshots,
  public.transcript_segments,
  public.saved_items,
  public.generated_artifacts,
  public.knowledge_jobs,
  public.expression_senses,
  public.expression_occurrences,
  public.user_expressions,
  public.practice_tasks,
  public.attempts,
  public.mastery_events,
  public.review_tasks
from service_role;
grant select, insert, update, delete on table
  public.profiles,
  public.video_sources,
  public.video_snapshots,
  public.transcript_segments,
  public.saved_items,
  public.generated_artifacts,
  public.knowledge_jobs,
  public.expression_senses,
  public.expression_occurrences,
  public.user_expressions,
  public.practice_tasks,
  public.attempts,
  public.mastery_events,
  public.review_tasks
to service_role;

revoke all on table public.knowledge_job_internal from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.knowledge_job_internal to service_role;

comment on table public.knowledge_job_internal is
  'Service-role-only durable input/result metadata. Provider references and payloads must not be exposed to clients.';

create function public.capture_saved_item(
  p_youtube_video_id text,
  p_client_event_id uuid,
  p_kind text,
  p_captured_at timestamptz,
  p_start_seconds numeric,
  p_payload jsonb
)
returns table (
  video_source_id uuid,
  saved_item_id uuid,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_video_source_id uuid;
  v_saved_item_id uuid;
  v_inserted boolean;
  v_dedupe_key text;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'capture requires an authenticated user',
      errcode = '42501';
  end if;

  select item.video_source_id, item.id
  into v_video_source_id, v_saved_item_id
  from public.saved_items as item
  where item.user_id = v_user_id
    and item.client_event_id = p_client_event_id;

  if found then
    return query
      select v_video_source_id, v_saved_item_id, 'saved'::text;
    return;
  end if;

  insert into public.video_sources (
    user_id,
    youtube_video_id,
    canonical_url
  ) values (
    v_user_id,
    p_youtube_video_id,
    'https://www.youtube.com/watch?v=' || p_youtube_video_id
  )
  on conflict (user_id, youtube_video_id) do update
    set canonical_url = excluded.canonical_url
  returning id into v_video_source_id;

  insert into public.saved_items (
    user_id,
    video_source_id,
    client_event_id,
    youtube_video_id,
    kind,
    status,
    captured_at,
    start_seconds,
    payload
  ) values (
    v_user_id,
    v_video_source_id,
    p_client_event_id,
    p_youtube_video_id,
    p_kind,
    'saved',
    p_captured_at,
    p_start_seconds,
    p_payload
  )
  on conflict (user_id, client_event_id) do nothing
  returning id into v_saved_item_id;

  v_inserted := found;

  if not v_inserted then
    select item.video_source_id, item.id
    into strict v_video_source_id, v_saved_item_id
    from public.saved_items as item
    where item.user_id = v_user_id
      and item.client_event_id = p_client_event_id;

    return query
      select v_video_source_id, v_saved_item_id, 'saved'::text;
    return;
  end if;

  v_dedupe_key := encode(
    extensions.digest(
      convert_to(
        jsonb_build_array(
          'popcorn-job-dedupe-v1',
          v_user_id::text,
          v_video_source_id::text,
          v_saved_item_id::text,
          'resolve_snapshot'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.knowledge_jobs (
    user_id,
    video_source_id,
    saved_item_id,
    job_type,
    status,
    dedupe_key
  ) values (
    v_user_id,
    v_video_source_id,
    v_saved_item_id,
    'resolve_snapshot',
    'pending',
    v_dedupe_key
  )
  on conflict (user_id, job_type, dedupe_key) do nothing;

  return query
    select v_video_source_id, v_saved_item_id, 'saved'::text;
end
$$;

revoke all on function public.capture_saved_item(text, uuid, text, timestamptz, numeric, jsonb)
  from public, anon;
grant execute on function public.capture_saved_item(text, uuid, text, timestamptz, numeric, jsonb)
  to authenticated;

comment on function public.capture_saved_item(text, uuid, text, timestamptz, numeric, jsonb) is
  'Atomically captures one authenticated YouTube learning snapshot request and queues server-side resolution.';
