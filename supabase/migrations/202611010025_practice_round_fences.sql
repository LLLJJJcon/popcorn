-- Preserve direct service-role fixture inserts while deriving identity on the
-- database side; browser roles still cannot INSERT these tables.
create function private.set_practice_round_identity() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare mark_key text;
begin
  select a.content->'candidates'->new.candidate_index->>'highlightKey' into mark_key
    from public.generated_artifacts a where a.id=new.candidate_artifact_id and a.user_id=new.user_id;
  new.candidate_key:=case when mark_key is not null then 'h:'||new.saved_item_id::text||':'||encode(extensions.digest(convert_to(mark_key,'UTF8'),'sha256'),'hex')
    else 'l:'||new.saved_item_id::text||':'||new.candidate_artifact_id::text||':'||new.candidate_index::text end;
  new.scenario_fingerprint:=private.practice_situation_fingerprint(new.prompt_chinese);
  return new;
end $$;
revoke all on function private.set_practice_round_identity() from public,anon,authenticated,service_role;
create trigger practice_round_identity before insert on public.practice_drafts for each row execute function private.set_practice_round_identity();

-- Every mutating path takes the candidate fence before attempt/draft row locks.
do $$ declare definition text;
begin
  definition:=pg_get_functiondef('private.promote_valid_practice_draft_attempt_source_active(uuid,uuid,text,timestamptz,integer)'::regprocedure);
  if strpos(definition,'  select staged.*')=0 then raise exception 'Promotion lock anchor missing';end if;
  definition:=replace(definition,'  select staged.*','  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || (select d.candidate_key from public.practice_drafts d join public.practice_draft_attempts a on a.practice_draft_id=d.id where a.id=p_practice_draft_attempt_id and a.user_id=p_user_id),0));
  select staged.*');
  execute definition;
end $$;

create function public.complete_due_practice_with_examples(p_user_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare review public.review_tasks%rowtype; assistance text; receipt_key text; completion record;
begin
  select * into review from public.review_tasks where id=(p_input->>'reviewTaskId')::uuid and user_id=p_user_id for update;
  if not found then raise exception using errcode='22023',message='owned review not found';end if;
  if review.status='completed' then
    select a.assistance_level into assistance from public.attempts a where a.id=review.completed_attempt_id and a.user_id=p_user_id;
    select r.request_key into receipt_key from private.due_practice_completion_receipts r where r.review_task_id=review.id and r.user_id=p_user_id;
  else
    assistance:=case when review.examples_opened_at is null then 'none' else 'model_answer' end;
    receipt_key:=encode(extensions.digest(convert_to(jsonb_build_array(p_user_id,review.id,p_input->>'practiceTaskId',p_input->>'responseChinese')::text,'UTF8'),'sha256'),'hex');
  end if;
  select * into completion from public.complete_due_practice(
    p_user_id,review.id,(p_input->>'practiceTaskId')::uuid,receipt_key,p_input->>'responseChinese',assistance,
    least((p_input->>'accuracyScore')::integer,(p_input->>'naturalnessScore')::integer,(p_input->>'contextualFitScore')::integer)>=3,
    (p_input->>'accuracyScore')::integer,p_input->>'accuracyFeedbackEnglish',
    (p_input->>'naturalnessScore')::integer,p_input->>'naturalnessFeedbackEnglish',
    (p_input->>'contextualFitScore')::integer,p_input->>'contextualFitFeedbackEnglish',(p_input->>'completedAt')::timestamptz,
    p_input->>'evaluationPromptVersion',p_input->>'evaluationModel',(p_input->>'evaluationGatewayConfigId')::uuid,
    (p_input->>'evaluationGatewayRevision')::integer,p_input->>'evaluationGatewayFingerprint');
  return jsonb_build_object('completion',to_jsonb(completion),'assistanceLevel',assistance);
end $$;
revoke all on function public.complete_due_practice_with_examples(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_due_practice_with_examples(uuid,jsonb) to service_role;
