-- Preserve independently generated cards across concurrent marked-analysis jobs.
create or replace function public.complete_learning_artifact_job(
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
  v_job_saved_item_id uuid;
  v_artifact_id uuid;
  v_artifact_source_id uuid;
  v_artifact_saved_item_id uuid;
  v_previous_content jsonb;
  v_previous_created_at timestamptz;
  v_created_at timestamptz := p_now;
  v_candidates jsonb := '[]'::jsonb;
  v_states jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_state jsonb;
begin
  if p_user_id is null
    or p_job_id is null
    or p_video_source_id is null
    or p_job_type is null
    or p_job_type not in (
      'generate_overview', 'translate_segments', 'explain_selection',
      'analyze_saved_item'
    )
    or p_expected_lease_expires_at is null
    or not isfinite(p_expected_lease_expires_at)
    or p_expected_attempt_count is null
    or p_expected_attempt_count not between 1 and 5
    or p_artifact_type is null
    or (p_job_type = 'generate_overview' and p_artifact_type <> 'overview')
    or (p_job_type = 'translate_segments' and p_artifact_type <> 'segment_translation')
    or (p_job_type = 'explain_selection' and p_artifact_type <> 'selection_explanation')
    or (p_job_type = 'analyze_saved_item' and p_artifact_type <> 'saved_item_analysis')
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

  select job.dedupe_key, job.saved_item_id
  into v_dedupe_key, v_job_saved_item_id
  from public.knowledge_jobs as job
  join public.knowledge_job_internal as internal
    on internal.knowledge_job_id = job.id
   and internal.user_id = job.user_id
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.video_source_id = p_video_source_id
    and (
      (p_job_type = 'analyze_saved_item' and job.saved_item_id is not null)
      or (p_job_type <> 'analyze_saved_item' and job.saved_item_id is null)
    )
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

  -- Serialize analysis publication per save. Existing practice keeps its original
  -- immutable artifact; every newer aggregate appends cards without moving indexes.
  if p_job_type = 'analyze_saved_item' and p_prompt_version = 'analyze-saved-item-v3' then
    perform 1 from public.saved_items as item
    where item.id = v_job_saved_item_id and item.user_id = p_user_id
      and item.video_source_id = p_video_source_id
    for update;
    if not found then return null; end if;

    if jsonb_typeof(p_content -> 'candidates') <> 'array'
      or jsonb_typeof(p_content -> 'highlightStates') <> 'array' then
      raise exception using errcode = '22023', message = 'invalid marked analysis content';
    end if;
    select artifact.content, artifact.created_at
      into v_previous_content, v_previous_created_at
    from public.generated_artifacts as artifact
    where artifact.user_id = p_user_id and artifact.saved_item_id = v_job_saved_item_id
      and artifact.video_source_id = p_video_source_id
      and artifact.artifact_type = 'saved_item_analysis'
      and artifact.prompt_version in ('analyze-saved-item-v1', 'analyze-saved-item-v2', 'analyze-saved-item-v3')
    order by artifact.created_at desc, artifact.id desc limit 1;
    if found then
      v_candidates := coalesce(v_previous_content -> 'candidates', '[]'::jsonb);
      v_states := coalesce(v_previous_content -> 'highlightStates', '[]'::jsonb);
      v_created_at := greatest(p_now, v_previous_created_at + interval '1 microsecond');
    end if;

    for v_candidate in select value from jsonb_array_elements(p_content -> 'candidates') loop
      if not exists (
        select 1 from jsonb_array_elements(v_candidates) as existing(value)
        where existing.value = v_candidate
          or (v_candidate ->> 'highlightKey' is not null
            and existing.value ->> 'highlightKey' = v_candidate ->> 'highlightKey')
      ) then
        v_candidates := v_candidates || jsonb_build_array(v_candidate);
      end if;
    end loop;
    for v_state in select value from jsonb_array_elements(p_content -> 'highlightStates') loop
      select coalesce(jsonb_agg(value order by ordinal), '[]'::jsonb) into v_states
      from jsonb_array_elements(v_states) with ordinality as previous(value, ordinal)
      where previous.value ->> 'highlightId' is distinct from v_state ->> 'highlightId';
      v_states := v_states || jsonb_build_array(v_state);
    end loop;
    p_content := jsonb_build_object('candidates', v_candidates, 'highlightStates', v_states);
    if octet_length(convert_to(p_content::text, 'UTF8')) > 262144 then
      raise exception using errcode = '22023', message = 'marked analysis aggregate too large';
    end if;
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
    v_job_saved_item_id,
    p_artifact_type,
    'en',
    'zh-CN',
    p_content,
    p_prompt_version,
    p_model,
    p_result_key,
    v_created_at
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
      or v_artifact_saved_item_id is distinct from v_job_saved_item_id then
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
