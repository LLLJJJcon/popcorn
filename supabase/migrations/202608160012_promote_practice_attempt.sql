create table private.practice_promotion_receipts (
  practice_draft_attempt_id uuid primary key,
  user_id uuid not null,
  practice_draft_id uuid not null,
  normalized_expression_text text not null,
  due_at timestamptz not null,
  interval_days integer not null,
  expression_sense_id uuid not null,
  occurrence_id uuid not null,
  user_expression_id uuid not null,
  practice_task_id uuid not null,
  attempt_id uuid not null,
  mastery_event_id uuid not null,
  review_task_id uuid not null,
  created_at timestamptz not null,
  constraint practice_promotion_receipt_attempt_owner_fk foreign key (
    practice_draft_attempt_id, user_id
  ) references public.practice_draft_attempts (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_draft_owner_fk foreign key (
    practice_draft_id, user_id
  ) references public.practice_drafts (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_sense_owner_fk foreign key (
    expression_sense_id, user_id
  ) references public.expression_senses (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_occurrence_owner_fk foreign key (
    occurrence_id, user_id
  ) references public.expression_occurrences (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_user_expression_owner_fk foreign key (
    user_expression_id, user_id
  ) references public.user_expressions (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_task_owner_fk foreign key (
    practice_task_id, user_id
  ) references public.practice_tasks (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_attempt_canonical_owner_fk foreign key (
    attempt_id, user_id
  ) references public.attempts (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_mastery_owner_fk foreign key (
    mastery_event_id, user_id
  ) references public.mastery_events (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_review_owner_fk foreign key (
    review_task_id, user_id
  ) references public.review_tasks (id, user_id) on delete restrict,
  constraint practice_promotion_receipt_schedule_check check (interval_days = 1),
  constraint practice_promotion_receipt_normalized_check check (
    private.is_target_chinese(normalized_expression_text, 200)
    and normalized_expression_text = btrim(normalized_expression_text)
  )
);

alter table private.practice_promotion_receipts enable row level security;
revoke all on table private.practice_promotion_receipts
  from public, anon, authenticated, service_role;

comment on table private.practice_promotion_receipts is
  'Private immutable idempotency receipt mapping one valid staged original attempt to its atomically promoted canonical learning graph.';

create function public.promote_valid_practice_draft_attempt(
  p_user_id uuid,
  p_practice_draft_attempt_id uuid,
  p_normalized_expression_text text,
  p_due_at timestamptz,
  p_interval_days integer
)
returns table (
  expression_sense_id uuid,
  occurrence_id uuid,
  user_expression_id uuid,
  practice_task_id uuid,
  attempt_id uuid,
  mastery_event_id uuid,
  review_task_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_attempt public.practice_draft_attempts%rowtype;
  v_draft public.practice_drafts%rowtype;
  v_receipt private.practice_promotion_receipts%rowtype;
  v_snapshot_id uuid;
  v_artifact_content jsonb;
  v_candidate jsonb;
  v_segment_ids text[];
  v_expression_sense_id uuid;
  v_occurrence_id uuid;
  v_mastery_event_id uuid;
  v_review_task_id uuid;
begin
  if p_user_id is null
    or p_practice_draft_attempt_id is null
    or p_normalized_expression_text is null
    or not private.is_target_chinese(p_normalized_expression_text, 200)
    or p_normalized_expression_text <> btrim(p_normalized_expression_text)
    or p_due_at is null
    or not isfinite(p_due_at)
    or p_interval_days is null
    or p_interval_days <> 1 then
    raise exception using
      errcode = '22023',
      message = 'invalid practice promotion input';
  end if;

  select staged.*
  into v_attempt
  from public.practice_draft_attempts as staged
  where staged.id = p_practice_draft_attempt_id
    and staged.user_id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'practice draft attempt does not belong to expected user';
  end if;

  select receipt.*
  into v_receipt
  from private.practice_promotion_receipts as receipt
  where receipt.practice_draft_attempt_id = p_practice_draft_attempt_id
    and receipt.user_id = p_user_id;

  if found then
    if v_receipt.normalized_expression_text <> p_normalized_expression_text
      or v_receipt.due_at <> p_due_at
      or v_receipt.interval_days <> p_interval_days then
      raise exception using
        errcode = '22023',
        message = 'practice promotion replay changed deterministic input';
    end if;
    return query select
      v_receipt.expression_sense_id,
      v_receipt.occurrence_id,
      v_receipt.user_expression_id,
      v_receipt.practice_task_id,
      v_receipt.attempt_id,
      v_receipt.mastery_event_id,
      v_receipt.review_task_id,
      false;
    return;
  end if;

  if v_attempt.revision <> 1 or not v_attempt.passed then
    raise exception using
      errcode = '22023',
      message = 'only a valid original practice attempt may be promoted';
  end if;

  if p_due_at <> v_attempt.submitted_at + interval '1 day' then
    raise exception using
      errcode = '22023',
      message = 'practice promotion due date is not deterministic';
  end if;

  select draft.*
  into v_draft
  from public.practice_drafts as draft
  where draft.id = v_attempt.practice_draft_id
    and draft.user_id = p_user_id
    and draft.future_user_expression_id = v_attempt.future_user_expression_id
  for update;

  if not found or v_draft.status <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'practice draft is not active for promotion';
  end if;

  select item.snapshot_id, artifact.content
  into v_snapshot_id, v_artifact_content
  from public.saved_items as item
  join public.generated_artifacts as artifact
    on artifact.id = v_draft.candidate_artifact_id
    and artifact.user_id = item.user_id
    and artifact.video_source_id = item.video_source_id
    and artifact.saved_item_id = item.id
    and artifact.artifact_type = 'saved_item_analysis'
  where item.id = v_draft.saved_item_id
    and item.user_id = p_user_id
    and item.video_source_id = v_draft.video_source_id;

  if not found or v_snapshot_id is null
    or jsonb_typeof(v_artifact_content -> 'candidates') is distinct from 'array'
    or jsonb_array_length(v_artifact_content -> 'candidates') <= v_draft.candidate_index then
    raise exception using
      errcode = '22023',
      message = 'practice promotion candidate evidence is unavailable';
  end if;

  v_candidate := v_artifact_content -> 'candidates' -> v_draft.candidate_index;
  if jsonb_typeof(v_candidate) is distinct from 'object'
    or v_candidate ->> 'expression' <> v_draft.target_expression
    or jsonb_typeof(v_candidate -> 'expression') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'englishMeaning') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'englishExplanation') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'tone') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'communicativeFunction') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'register') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'evidenceText') is distinct from 'string'
    or jsonb_typeof(v_candidate -> 'segmentIds') is distinct from 'array'
    or jsonb_array_length(v_candidate -> 'segmentIds') not between 1 and 32
    or exists (
      select 1
      from jsonb_array_elements(v_candidate -> 'segmentIds') as element(value)
      where jsonb_typeof(element.value) is distinct from 'string'
    )
    or jsonb_typeof(v_candidate -> 'startSeconds') is distinct from 'number'
    or jsonb_typeof(v_candidate -> 'endSeconds') is distinct from 'number'
    or jsonb_typeof(v_candidate -> 'confidence') is distinct from 'number' then
    raise exception using
      errcode = '22023',
      message = 'practice promotion candidate is invalid';
  end if;

  select array_agg(element.value #>> '{}' order by element.ordinality)
  into v_segment_ids
  from jsonb_array_elements(v_candidate -> 'segmentIds') with ordinality
    as element(value, ordinality);

  insert into public.expression_senses (
    user_id,
    video_source_id,
    saved_item_id,
    expression_text,
    normalized_expression_text,
    english_meaning,
    english_explanation,
    tone,
    communicative_function,
    register,
    created_at,
    updated_at
  ) values (
    p_user_id,
    v_draft.video_source_id,
    v_draft.saved_item_id,
    v_candidate ->> 'expression',
    p_normalized_expression_text,
    v_candidate ->> 'englishMeaning',
    v_candidate ->> 'englishExplanation',
    v_candidate ->> 'tone',
    v_candidate ->> 'communicativeFunction',
    v_candidate ->> 'register',
    v_attempt.submitted_at,
    v_attempt.submitted_at
  ) returning id into v_expression_sense_id;

  insert into public.expression_occurrences (
    user_id,
    video_source_id,
    expression_sense_id,
    snapshot_id,
    saved_item_id,
    evidence_text,
    segment_ids,
    start_seconds,
    end_seconds,
    confidence,
    created_at
  ) values (
    p_user_id,
    v_draft.video_source_id,
    v_expression_sense_id,
    v_snapshot_id,
    v_draft.saved_item_id,
    v_candidate ->> 'evidenceText',
    v_segment_ids,
    (v_candidate ->> 'startSeconds')::numeric,
    (v_candidate ->> 'endSeconds')::numeric,
    (v_candidate ->> 'confidence')::numeric,
    v_attempt.submitted_at
  ) returning id into v_occurrence_id;

  insert into public.user_expressions (
    id, user_id, expression_sense_id, mastery_state, created_at, updated_at
  ) values (
    v_draft.future_user_expression_id,
    p_user_id,
    v_expression_sense_id,
    'tried',
    v_attempt.submitted_at,
    v_attempt.submitted_at
  );

  insert into public.practice_tasks (
    id, user_id, user_expression_id, kind, native_language, target_language,
    target_expression, prompt_chinese, instructions_english, goal_english, due_at,
    created_at, activation_prompt_version, activation_model,
    activation_gateway_config_id, activation_gateway_revision,
    activation_gateway_fingerprint
  ) values (
    v_draft.id, p_user_id, v_draft.future_user_expression_id, 'use_it_now',
    v_draft.native_language, v_draft.target_language, v_draft.target_expression,
    v_draft.prompt_chinese, v_draft.instructions_english, v_draft.goal_english, null,
    v_draft.created_at, v_draft.activation_prompt_version, v_draft.activation_model,
    v_draft.activation_gateway_config_id, v_draft.activation_gateway_revision,
    v_draft.activation_gateway_fingerprint
  );

  insert into public.attempts (
    id, user_id, practice_task_id, user_expression_id, response_chinese, passed,
    accuracy_score, accuracy_feedback_english, naturalness_score,
    naturalness_feedback_english, contextual_fit_score,
    contextual_fit_feedback_english, independent_use, assistance_level,
    submitted_at, created_at, evaluation_prompt_version, evaluation_model,
    evaluation_gateway_config_id, evaluation_gateway_revision,
    evaluation_gateway_fingerprint
  ) values (
    v_attempt.id, p_user_id, v_draft.id, v_draft.future_user_expression_id,
    v_attempt.response_chinese, v_attempt.passed, v_attempt.accuracy_score,
    v_attempt.accuracy_feedback_english, v_attempt.naturalness_score,
    v_attempt.naturalness_feedback_english, v_attempt.contextual_fit_score,
    v_attempt.contextual_fit_feedback_english, v_attempt.independent_use,
    v_attempt.assistance_level, v_attempt.submitted_at, v_attempt.created_at,
    v_attempt.evaluation_prompt_version, v_attempt.evaluation_model,
    v_attempt.evaluation_gateway_config_id, v_attempt.evaluation_gateway_revision,
    v_attempt.evaluation_gateway_fingerprint
  );

  insert into public.mastery_events (
    user_id, user_expression_id, attempt_id, prior_state, new_state,
    evidence_kind, occurred_at, created_at
  ) values (
    p_user_id, v_draft.future_user_expression_id, v_attempt.id, null, 'tried',
    'valid_original_attempt', v_attempt.submitted_at, v_attempt.submitted_at
  ) returning id into v_mastery_event_id;

  insert into public.review_tasks (
    user_id, user_expression_id, mastery_state, status, due_at, interval_days,
    consecutive_successes, created_at, updated_at
  ) values (
    p_user_id, v_draft.future_user_expression_id, 'tried', 'pending', p_due_at,
    p_interval_days, 0, v_attempt.submitted_at, v_attempt.submitted_at
  ) returning id into v_review_task_id;

  update public.practice_drafts
  set status = 'completed', updated_at = v_attempt.submitted_at
  where id = v_draft.id and user_id = p_user_id and status = 'active';

  if not found then
    raise exception using
      errcode = '40001',
      message = 'practice draft promotion lost its active fence';
  end if;

  insert into private.practice_promotion_receipts (
    practice_draft_attempt_id, user_id, practice_draft_id,
    normalized_expression_text, due_at, interval_days, expression_sense_id,
    occurrence_id, user_expression_id, practice_task_id, attempt_id,
    mastery_event_id, review_task_id, created_at
  ) values (
    v_attempt.id, p_user_id, v_draft.id, p_normalized_expression_text, p_due_at,
    p_interval_days, v_expression_sense_id, v_occurrence_id,
    v_draft.future_user_expression_id, v_draft.id, v_attempt.id,
    v_mastery_event_id, v_review_task_id, v_attempt.submitted_at
  );

  return query select
    v_expression_sense_id,
    v_occurrence_id,
    v_draft.future_user_expression_id,
    v_draft.id,
    v_attempt.id,
    v_mastery_event_id,
    v_review_task_id,
    true;
end
$$;

revoke all on function public.promote_valid_practice_draft_attempt(
  uuid, uuid, text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.promote_valid_practice_draft_attempt(
  uuid, uuid, text, timestamptz, integer
) to service_role;

comment on function public.promote_valid_practice_draft_attempt(
  uuid, uuid, text, timestamptz, integer
) is
  'Atomically and idempotently promotes one valid staged original response into source-grounded tried evidence and deterministic due Practice.';
