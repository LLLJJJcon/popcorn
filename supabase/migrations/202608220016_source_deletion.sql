alter table public.expression_senses
  add column source_deleted_at timestamptz,
  alter column video_source_id drop not null,
  add constraint expression_sense_source_lifecycle_check check (
    (source_deleted_at is null and video_source_id is not null)
    or
    (source_deleted_at is not null and video_source_id is null and saved_item_id is null)
  );

alter table private.practice_promotion_receipts
  drop constraint practice_promotion_receipt_attempt_owner_fk,
  drop constraint practice_promotion_receipt_draft_owner_fk,
  drop constraint practice_promotion_receipt_occurrence_owner_fk,
  alter column occurrence_id drop not null,
  add column deleted_occurrence_id uuid,
  add column source_deleted_at timestamptz,
  add constraint practice_promotion_receipt_canonical_attempt_owner_fk foreign key (
    practice_draft_attempt_id, user_id
  ) references public.attempts (id, user_id) on delete restrict,
  add constraint practice_promotion_receipt_canonical_task_owner_fk foreign key (
    practice_draft_id, user_id
  ) references public.practice_tasks (id, user_id) on delete restrict,
  add constraint practice_promotion_receipt_occurrence_owner_fk foreign key (
    occurrence_id, user_id
  ) references public.expression_occurrences (id, user_id) on delete restrict,
  add constraint practice_promotion_receipt_source_lifecycle_check check (
    (source_deleted_at is null
      and occurrence_id is not null
      and deleted_occurrence_id is null)
    or
    (source_deleted_at is not null
      and occurrence_id is null
      and deleted_occurrence_id is not null)
  );

comment on column public.expression_senses.source_deleted_at is
  'Explicit tombstone: source identity and locators were deleted while canonical learning semantics remain.';
comment on column private.practice_promotion_receipts.deleted_occurrence_id is
  'Immutable historical occurrence identity retained after the source occurrence and every locator are deleted.';

alter function public.promote_valid_practice_draft_attempt(
  uuid, uuid, text, timestamptz, integer
) rename to promote_valid_practice_draft_attempt_source_active;
alter function public.promote_valid_practice_draft_attempt_source_active(
  uuid, uuid, text, timestamptz, integer
) set schema private;
revoke all on function private.promote_valid_practice_draft_attempt_source_active(
  uuid, uuid, text, timestamptz, integer
) from public, anon, authenticated, service_role;

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
  v_receipt private.practice_promotion_receipts%rowtype;
begin
  if p_user_id is null
    or p_practice_draft_attempt_id is null
    or p_normalized_expression_text is null
    or not private.is_target_chinese(p_normalized_expression_text, 200)
    or p_normalized_expression_text <> pg_catalog.btrim(p_normalized_expression_text)
    or p_due_at is null
    or not pg_catalog.isfinite(p_due_at)
    or p_interval_days is null
    or p_interval_days <> 1 then
    raise exception using
      errcode = '22023',
      message = 'invalid practice promotion input';
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
      coalesce(v_receipt.occurrence_id, v_receipt.deleted_occurrence_id),
      v_receipt.user_expression_id,
      v_receipt.practice_task_id,
      v_receipt.attempt_id,
      v_receipt.mastery_event_id,
      v_receipt.review_task_id,
      false;
    return;
  end if;

  return query
  select result.expression_sense_id, result.occurrence_id,
    result.user_expression_id, result.practice_task_id, result.attempt_id,
    result.mastery_event_id, result.review_task_id, result.created
  from private.promote_valid_practice_draft_attempt_source_active(
    p_user_id,
    p_practice_draft_attempt_id,
    p_normalized_expression_text,
    p_due_at,
    p_interval_days
  ) as result;
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
  'Promotes active source-grounded practice or exactly replays immutable canonical identities after source deletion.';

create function public.delete_video_source(
  p_user_id uuid,
  p_video_source_id uuid,
  p_mode text,
  p_now timestamptz
)
returns table (
  deleted boolean,
  retained_user_expression_count integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_retained_count integer;
begin
  if p_user_id is null
    or p_video_source_id is null
    or p_mode not in ('remove_unpracticed_source','remove_source_keep_evidence')
    or p_now is null
    or not pg_catalog.isfinite(p_now) then
    raise exception using errcode='22023', message='invalid source deletion input';
  end if;

  perform 1
  from public.video_sources as source
  where source.id = p_video_source_id
    and source.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode='22023', message='owned source not found';
  end if;

  select pg_catalog.count(*)::integer
  into v_retained_count
  from public.user_expressions as expression
  join public.expression_senses as sense
    on sense.id = expression.expression_sense_id
    and sense.user_id = expression.user_id
  where expression.user_id = p_user_id
    and sense.video_source_id = p_video_source_id;

  if (p_mode = 'remove_unpracticed_source' and v_retained_count <> 0)
    or (p_mode = 'remove_source_keep_evidence' and v_retained_count = 0) then
    raise exception using errcode='22023', message='source deletion mode does not match current evidence';
  end if;

  update public.knowledge_jobs as job
  set status='terminal_failed', next_attempt_at=null, lease_expires_at=null,
    last_error_code='SOURCE_DELETED', updated_at=p_now
  where job.user_id=p_user_id
    and job.video_source_id=p_video_source_id
    and job.status in ('pending','leased','retryable_failed');

  delete from private.learning_artifact_gateway_pins as pin
  using public.knowledge_jobs as job
  where pin.knowledge_job_id=job.id and pin.user_id=job.user_id
    and job.user_id=p_user_id and job.video_source_id=p_video_source_id;
  delete from public.knowledge_job_internal as internal
  using public.knowledge_jobs as job
  where internal.knowledge_job_id=job.id and internal.user_id=job.user_id
    and job.user_id=p_user_id and job.video_source_id=p_video_source_id;
  delete from public.knowledge_jobs as job
  where job.user_id=p_user_id and job.video_source_id=p_video_source_id;

  if p_mode = 'remove_source_keep_evidence' then
    update private.practice_promotion_receipts as receipt
    set deleted_occurrence_id=receipt.occurrence_id,
      occurrence_id=null,
      source_deleted_at=p_now
    from public.expression_senses as sense
    where receipt.expression_sense_id=sense.id
      and receipt.user_id=sense.user_id
      and receipt.user_id=p_user_id
      and sense.video_source_id=p_video_source_id
      and receipt.source_deleted_at is null;
  end if;

  delete from public.practice_draft_attempts as attempt
  using public.practice_drafts as draft
  where attempt.practice_draft_id=draft.id and attempt.user_id=draft.user_id
    and draft.user_id=p_user_id and draft.video_source_id=p_video_source_id;
  delete from public.practice_drafts as draft
  where draft.user_id=p_user_id and draft.video_source_id=p_video_source_id;
  delete from public.expression_occurrences as occurrence
  where occurrence.user_id=p_user_id and occurrence.video_source_id=p_video_source_id;

  if p_mode = 'remove_source_keep_evidence' then
    delete from public.expression_senses as sense
    where sense.user_id=p_user_id and sense.video_source_id=p_video_source_id
      and not exists (
        select 1 from public.user_expressions as expression
        where expression.user_id=sense.user_id
          and expression.expression_sense_id=sense.id
      );
    update public.expression_senses as sense
    set saved_item_id=null, video_source_id=null,
      source_deleted_at=p_now, updated_at=p_now
    where sense.user_id=p_user_id and sense.video_source_id=p_video_source_id;
  else
    delete from public.expression_senses as sense
    where sense.user_id=p_user_id and sense.video_source_id=p_video_source_id;
  end if;

  delete from public.generated_artifacts as artifact
  where artifact.user_id=p_user_id and artifact.video_source_id=p_video_source_id;
  delete from public.saved_items as item
  where item.user_id=p_user_id and item.video_source_id=p_video_source_id;
  delete from public.transcript_segments as segment
  using public.video_snapshots as snapshot
  where segment.snapshot_id=snapshot.id and segment.user_id=snapshot.user_id
    and snapshot.user_id=p_user_id and snapshot.video_source_id=p_video_source_id;
  delete from public.video_snapshots as snapshot
  where snapshot.user_id=p_user_id and snapshot.video_source_id=p_video_source_id;
  delete from public.video_sources as source
  where source.id=p_video_source_id and source.user_id=p_user_id;
  if not found then
    raise exception using errcode='40001', message='source deletion lost its ownership fence';
  end if;

  return query select true, v_retained_count;
end
$$;

revoke all on function public.delete_video_source(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.delete_video_source(
  uuid, uuid, text, timestamptz
) to service_role;

comment on function public.delete_video_source(
  uuid, uuid, text, timestamptz
) is
  'Atomically deletes one owned YouTube source graph, retaining only canonical practiced evidence when explicitly requested.';
