create function public.register_learning_artifact_job(
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
  v_created boolean := false;
begin
  if p_user_id is null
    or p_video_source_id is null
    or p_job_type is null
    or p_job_type not in (
      'generate_overview', 'translate_segments', 'explain_selection'
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
    null,
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

    if v_source_id <> p_video_source_id or v_saved_item_id is not null then
      raise exception using
        errcode = '22023',
        message = 'dedupe key belongs to a different learning-artifact source';
    end if;
  end if;

  return query select v_job_id, v_status, v_created;
end
$$;

revoke all on function public.register_learning_artifact_job(
  uuid, uuid, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_learning_artifact_job(
  uuid, uuid, text, text, jsonb, timestamptz
) to service_role;

comment on function public.register_learning_artifact_job(
  uuid, uuid, text, text, jsonb, timestamptz
) is
  'Atomically registers one bounded source-level learning-artifact job. Replays return existing public state without replacing private input or result.';

create function public.transition_learning_artifact_failure(
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
      'generate_overview', 'translate_segments', 'explain_selection'
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
    and job.saved_item_id is null
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

revoke all on function public.transition_learning_artifact_failure(
  uuid, uuid, uuid, text, timestamptz, integer, text, timestamptz, text,
  boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.transition_learning_artifact_failure(
  uuid, uuid, uuid, text, timestamptz, integer, text, timestamptz, text,
  boolean, timestamptz
) to service_role;

comment on function public.transition_learning_artifact_failure(
  uuid, uuid, uuid, text, timestamptz, integer, text, timestamptz, text,
  boolean, timestamptz
) is
  'Lease-fenced learning-artifact failure transition with exact retry clocks, private-byte preservation, and atomic terminal input clearing.';

create function public.complete_learning_artifact_job(
  p_user_id uuid,
  p_job_id uuid,
  p_video_source_id uuid,
  p_job_type text,
  p_expected_lease_expires_at timestamptz,
  p_expected_attempt_count integer,
  p_artifact_type text,
  p_content jsonb,
  p_prompt_version text,
  p_model text,
  p_result_key text,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_dedupe_key text;
  v_artifact_id uuid;
  v_artifact_source_id uuid;
  v_artifact_saved_item_id uuid;
begin
  if p_user_id is null
    or p_job_id is null
    or p_video_source_id is null
    or p_job_type is null
    or p_job_type not in (
      'generate_overview', 'translate_segments', 'explain_selection'
    )
    or p_expected_lease_expires_at is null
    or not isfinite(p_expected_lease_expires_at)
    or p_expected_attempt_count is null
    or p_expected_attempt_count not between 1 and 5
    or p_artifact_type is null
    or (p_job_type = 'generate_overview' and p_artifact_type <> 'overview')
    or (p_job_type = 'translate_segments' and p_artifact_type <> 'segment_translation')
    or (p_job_type = 'explain_selection' and p_artifact_type <> 'selection_explanation')
    or p_content is null
    or jsonb_typeof(p_content) <> 'object'
    or octet_length(convert_to(p_content::text, 'UTF8')) > 262144
    or p_prompt_version is null
    or length(p_prompt_version) not between 1 and 100
    or p_prompt_version <> btrim(p_prompt_version)
    or p_model is null
    or length(p_model) not between 1 and 100
    or p_model <> btrim(p_model)
    or p_result_key is null
    or p_result_key !~ '^[a-f0-9]{64}$'
    or p_now is null
    or not isfinite(p_now)
    or p_expected_lease_expires_at <= p_now then
    raise exception using
      errcode = '22023',
      message = 'invalid learning-artifact completion input';
  end if;

  select job.dedupe_key
  into v_dedupe_key
  from public.knowledge_jobs as job
  join public.knowledge_job_internal as internal
    on internal.knowledge_job_id = job.id
   and internal.user_id = job.user_id
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.video_source_id = p_video_source_id
    and job.saved_item_id is null
    and job.job_type = p_job_type
    and job.status = 'leased'
    and job.lease_expires_at = p_expected_lease_expires_at
    and job.attempt_count = p_expected_attempt_count
  for update of job, internal;

  if not found then
    return null;
  end if;

  if p_result_key <> v_dedupe_key then
    raise exception using
      errcode = '22023',
      message = 'artifact result key must equal the leased job dedupe key';
  end if;

  insert into public.generated_artifacts as artifact (
    user_id,
    video_source_id,
    saved_item_id,
    artifact_type,
    native_language,
    target_language,
    content,
    prompt_version,
    model,
    result_key,
    created_at
  ) values (
    p_user_id,
    p_video_source_id,
    null,
    p_artifact_type,
    'en',
    'zh-CN',
    p_content,
    p_prompt_version,
    p_model,
    p_result_key,
    p_now
  )
  on conflict (user_id, artifact_type, result_key) do nothing
  returning artifact.id, artifact.video_source_id, artifact.saved_item_id
  into v_artifact_id, v_artifact_source_id, v_artifact_saved_item_id;

  if not found then
    select artifact.id, artifact.video_source_id, artifact.saved_item_id
    into strict v_artifact_id, v_artifact_source_id, v_artifact_saved_item_id
    from public.generated_artifacts as artifact
    where artifact.user_id = p_user_id
      and artifact.artifact_type = p_artifact_type
      and artifact.result_key = p_result_key
    for update of artifact;

    if v_artifact_source_id <> p_video_source_id
      or v_artifact_saved_item_id is not null then
      raise exception using
        errcode = '22023',
        message = 'artifact result key belongs to a different source';
    end if;
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

  update public.knowledge_job_internal as internal
  set
    input = '{}'::jsonb,
    result = jsonb_build_object('artifactId', v_artifact_id),
    updated_at = p_now
  where internal.knowledge_job_id = p_job_id
    and internal.user_id = p_user_id;

  return v_artifact_id;
end
$$;

revoke all on function public.complete_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  timestamptz
) to service_role;

comment on function public.complete_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  timestamptz
) is
  'Atomically publishes one idempotent bounded learning artifact, succeeds its exact leased job, writes a strict private artifact reference, and clears private input.';
