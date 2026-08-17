create function public.register_resolve_snapshot_job(
  p_user_id uuid,
  p_video_source_id uuid,
  p_dedupe_key text,
  p_provider_job_id text,
  p_now timestamptz
)
returns table (
  knowledge_job_id uuid,
  status text,
  created_or_attached boolean
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
  v_created boolean := false;
begin
  if p_user_id is null
    or p_video_source_id is null
    or p_now is null
    or not isfinite(p_now)
    or p_dedupe_key is null
    or p_dedupe_key !~ '^[a-f0-9]{64}$'
    or p_provider_job_id is null
    or length(p_provider_job_id) not between 1 and 200
    or p_provider_job_id <> btrim(p_provider_job_id) then
    raise exception using
      errcode = '22023',
      message = 'invalid resolve_snapshot registration input';
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

  insert into public.knowledge_jobs (
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
    null,
    'resolve_snapshot',
    'pending',
    p_dedupe_key,
    0,
    p_now,
    p_now
  )
  on conflict (user_id, job_type, dedupe_key) do nothing
  returning id, knowledge_jobs.status, video_source_id, saved_item_id
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
      jsonb_build_object('providerJobId', p_provider_job_id),
      null,
      p_now,
      p_now
    );
  else
    select job.id, job.status, job.video_source_id, job.saved_item_id
    into strict v_job_id, v_status, v_source_id, v_saved_item_id
    from public.knowledge_jobs as job
    where job.user_id = p_user_id
      and job.job_type = 'resolve_snapshot'
      and job.dedupe_key = p_dedupe_key;

    if v_source_id <> p_video_source_id or v_saved_item_id is not null then
      raise exception using
        errcode = '22023',
        message = 'dedupe key belongs to a different resolve_snapshot source';
    end if;
  end if;

  return query select v_job_id, v_status, v_created;
end
$$;

revoke all on function public.register_resolve_snapshot_job(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_resolve_snapshot_job(
  uuid, uuid, text, text, timestamptz
) to service_role;

comment on function public.register_resolve_snapshot_job(
  uuid, uuid, text, text, timestamptz
) is
  'Atomically registers one source-level transcript Provider job. Replays return existing public state without replacing private input or result.';

create function public.transition_resolve_snapshot_failure(
  p_user_id uuid,
  p_job_id uuid,
  p_expected_lease_expires_at timestamptz,
  p_expected_attempt_count integer,
  p_target_status text,
  p_next_attempt_at timestamptz,
  p_error_code text,
  p_provider_job_id text,
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
    or p_expected_lease_expires_at <= p_now
    or (p_provider_job_id is not null and (
      length(p_provider_job_id) not between 1 and 200
      or p_provider_job_id <> btrim(p_provider_job_id)
    ))
    or (p_provider_job_id is not null and p_clear_input) then
    raise exception using
      errcode = '22023',
      message = 'invalid resolve_snapshot failure transition input';
  end if;

  if p_target_status = 'retryable_failed' then
    if p_expected_attempt_count >= 5
      or p_next_attempt_at is null
      or not isfinite(p_next_attempt_at)
      or p_next_attempt_at <> p_now
        + least(60 * power(2, p_expected_attempt_count - 1), 3600)
          * interval '1 second'
      or p_clear_input then
      raise exception using
        errcode = '22023',
        message = 'retryable failure requires attempts one through four and a future retry clock';
    end if;
  elsif p_target_status = 'terminal_failed' then
    if p_next_attempt_at is not null
      or p_provider_job_id is not null
      or not p_clear_input then
      raise exception using
        errcode = '22023',
        message = 'terminal failure requires private input clearing and no retry clock';
    end if;
  else
    raise exception using
      errcode = '22023',
      message = 'failure target must be retryable_failed or terminal_failed';
  end if;

  update public.knowledge_jobs as job
  set
    status = p_target_status,
    next_attempt_at = p_next_attempt_at,
    lease_expires_at = null,
    last_error_code = p_error_code,
    updated_at = p_now
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'resolve_snapshot'
    and job.status = 'leased'
    and job.lease_expires_at = p_expected_lease_expires_at
    and job.attempt_count = p_expected_attempt_count
  returning job.id into v_job_id;

  if not found then
    return false;
  end if;

  if p_provider_job_id is not null then
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
      jsonb_build_object('providerJobId', p_provider_job_id),
      null,
      p_now,
      p_now
    )
    on conflict (knowledge_job_id) do nothing;
  elsif p_clear_input then
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
      '{}'::jsonb,
      null,
      p_now,
      p_now
    )
    on conflict (knowledge_job_id) do update
      set input = '{}'::jsonb,
          updated_at = p_now
      where knowledge_job_internal.user_id = p_user_id;
  end if;

  return true;
end
$$;

revoke all on function public.transition_resolve_snapshot_failure(
  uuid, uuid, timestamptz, integer, text, timestamptz, text, text, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.transition_resolve_snapshot_failure(
  uuid, uuid, timestamptz, integer, text, timestamptz, text, text, boolean, timestamptz
) to service_role;

comment on function public.transition_resolve_snapshot_failure(
  uuid, uuid, timestamptz, integer, text, timestamptz, text, text, boolean, timestamptz
) is
  'Lease-fenced resolve_snapshot failure transition with atomic private Provider input attach, preservation, or terminal clearing.';

create function public.complete_resolve_snapshot_job(
  p_user_id uuid,
  p_job_id uuid,
  p_expected_lease_expires_at timestamptz,
  p_expected_attempt_count integer,
  p_snapshot_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_video_source_id uuid;
  v_saved_item_id uuid;
begin
  if p_user_id is null
    or p_job_id is null
    or p_expected_lease_expires_at is null
    or not isfinite(p_expected_lease_expires_at)
    or p_expected_attempt_count is null
    or p_expected_attempt_count not between 1 and 5
    or p_snapshot_id is null
    or p_now is null
    or not isfinite(p_now)
    or p_expected_lease_expires_at <= p_now then
    raise exception using
      errcode = '22023',
      message = 'invalid resolve_snapshot completion input';
  end if;

  select job.video_source_id, job.saved_item_id
  into v_video_source_id, v_saved_item_id
  from public.knowledge_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'resolve_snapshot'
    and job.status = 'leased'
    and job.lease_expires_at = p_expected_lease_expires_at
    and job.attempt_count = p_expected_attempt_count
  for update of job;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from public.video_snapshots as snapshot
    where snapshot.id = p_snapshot_id
      and snapshot.user_id = p_user_id
      and snapshot.video_source_id = v_video_source_id
  ) then
    return false;
  end if;

  update public.knowledge_jobs as job
  set
    status = 'succeeded',
    next_attempt_at = null,
    lease_expires_at = null,
    last_error_code = null,
    updated_at = p_now
  where job.id = p_job_id
    and job.user_id = p_user_id;

  insert into public.knowledge_job_internal (
    knowledge_job_id,
    user_id,
    input,
    result,
    created_at,
    updated_at
  ) values (
    p_job_id,
    p_user_id,
    '{}'::jsonb,
    jsonb_build_object('snapshotId', p_snapshot_id),
    p_now,
    p_now
  )
  on conflict (knowledge_job_id) do update
    set input = '{}'::jsonb,
        result = jsonb_build_object('snapshotId', p_snapshot_id),
        updated_at = p_now
    where knowledge_job_internal.user_id = p_user_id;

  if v_saved_item_id is not null then
    update public.saved_items as item
    set
      snapshot_id = p_snapshot_id,
      status = 'ready',
      updated_at = p_now
    where item.id = v_saved_item_id
      and item.user_id = p_user_id
      and item.video_source_id = v_video_source_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'resolve_snapshot saved item ownership changed';
    end if;
  end if;

  return true;
end
$$;

revoke all on function public.complete_resolve_snapshot_job(
  uuid, uuid, timestamptz, integer, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_resolve_snapshot_job(
  uuid, uuid, timestamptz, integer, uuid, timestamptz
) to service_role;

comment on function public.complete_resolve_snapshot_job(
  uuid, uuid, timestamptz, integer, uuid, timestamptz
) is
  'Atomically completes a leased resolve_snapshot job, publishes one bounded snapshot result, clears private input, and readies its exact save.';
