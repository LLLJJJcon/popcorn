-- Request receipts bound model cost as well as the existing official graph.
-- Source display/metadata is deliberately unnecessary for completed replay.
do $$declare definition text;anchor constant text := $anchor$  'officialAttempt',$anchor$;
begin
 definition:=pg_get_functiondef('public.read_review_practice_context(uuid,uuid)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Review official graph read anchor missing';end if;
 definition:=replace(definition,anchor,$replacement$  'masteryEvents',(select coalesce(jsonb_agg(to_jsonb(event) order by event.id),'[]'::jsonb) from public.mastery_events event where event.user_id=p_user_id and event.attempt_id=r.completed_attempt_id),
$replacement$||anchor);
 execute definition;
end $$;
create function public.lookup_review_completion(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_now timestamptz default statement_timestamp()) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare op private.review_operations%rowtype;
begin
 if not exists(select 1 from public.review_tasks where user_id=p_user_id and id=p_review_task_id) then return null;end if;
 select * into op from private.review_operations where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid;
 if not found then return null;end if;
 if op.review_task_id<>p_review_task_id or op.kind<>'complete' or op.request_hash<>private.review_request_hash('complete',p_review_task_id,p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status='succeeded' then return jsonb_build_object('kind','ready','response',op.response);end if;
 if op.status='failed' then return jsonb_build_object('kind','failed','code',op.error_code);end if;
 if op.lease_expires_at<=p_now then return jsonb_build_object('kind','failed','code','PROVIDER_UNAVAILABLE');end if;
 return jsonb_build_object('kind','pending');
end $$;

create function public.claim_review_completion(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;existing jsonb;token uuid:=gen_random_uuid();answer text;
begin
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid completion clock';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found or r.status='cancelled' then raise exception using errcode='22023',message='owned review not found';end if;
 existing:=public.lookup_review_completion(p_user_id,r.id,p_input,p_now);
 if existing is not null then
  if existing->>'kind'='failed' then raise exception using errcode='P0001',message=coalesce(existing->>'code','PROVIDER_UNAVAILABLE');end if;
  return existing;
 end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and user_expression_id=r.user_expression_id and kind='due_practice' for update;
 if t.id is null or t.id::text is distinct from p_input->>'taskId' or t.scenario_version is distinct from (p_input->>'scenarioVersion')::integer or t.scenario_fingerprint is distinct from p_input->>'scenarioFingerprint' then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 if r.status='completed' then
  select response_chinese into answer from public.attempts where id=r.completed_attempt_id and user_id=p_user_id and practice_task_id=t.id;
  if answer is distinct from p_input->>'responseChinese' then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
  return jsonb_build_object('kind','ready');
 end if;
 if r.due_at>p_now or not exists(select 1 from public.user_expressions e where e.id=r.user_expression_id and e.user_id=p_user_id and e.mastery_state=r.mastery_state) then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 if not private.is_target_chinese(p_input->>'responseChinese',10000) then raise exception using errcode='22023',message='invalid completion response';end if;
 insert into private.review_operations(user_id,review_task_id,request_id,kind,request_hash,status,claim_token,lease_expires_at,expected_version,expected_fingerprint,created_at,updated_at)
 values(p_user_id,r.id,(p_input->>'requestId')::uuid,'complete',private.review_request_hash('complete',r.id,p_input),'claimed',token,p_now+interval '5 minutes',t.scenario_version,t.scenario_fingerprint,p_now,p_now);
 return jsonb_build_object('kind','claimed','token',token);
end $$;

create function public.publish_review_completion(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_token uuid,p_result jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;op private.review_operations%rowtype;a public.attempts%rowtype;receipt private.due_practice_completion_receipts%rowtype;evaluation jsonb;payload jsonb;result jsonb;expected_prompt text;has_pin boolean;
begin
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid completion clock';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found then raise exception using errcode='22023',message='owned review not found';end if;
 select * into op from private.review_operations where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid for update;
 if op.review_task_id is distinct from r.id or op.kind is distinct from 'complete' or op.request_hash is distinct from private.review_request_hash('complete',r.id,p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status='succeeded' then return op.response;end if;
 if op.status is distinct from 'claimed' or op.claim_token is distinct from p_token or op.lease_expires_at<=p_now then raise exception using errcode='P0001',message='JOB_LEASE_CONFLICT';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice' for update;
 if t.id is null or t.id::text is distinct from p_input->>'taskId' or t.scenario_version is distinct from op.expected_version or t.scenario_fingerprint is distinct from op.expected_fingerprint or t.scenario_version is distinct from (p_input->>'scenarioVersion')::integer or t.scenario_fingerprint is distinct from p_input->>'scenarioFingerprint' then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 if r.status='cancelled' then raise exception using errcode='22023',message='owned review not found';end if;
 if r.status='completed' then
  select * into a from public.attempts where id=r.completed_attempt_id and user_id=p_user_id and practice_task_id=t.id;
  select * into receipt from private.due_practice_completion_receipts where user_id=p_user_id and review_task_id=r.id;
  if a.id is null or receipt.attempt_id is distinct from a.id or a.response_chinese is distinct from p_input->>'responseChinese' then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
  result:=jsonb_build_object('completion',to_jsonb(receipt)||jsonb_build_object('created',false),'assistanceLevel',a.assistance_level);
 else
  expected_prompt:=case when t.scenario_metadata_mode='modern' then 'evaluate-practice-v5' else 'evaluate-practice-v4' end;
  if p_result->>'promptVersion' is distinct from expected_prompt then raise exception using errcode='22023',message='invalid completion prompt';end if;
  has_pin:=p_result->'pin' is not null and p_result->'pin'<>'null'::jsonb;
  if not has_pin and coalesce(p_result->>'model','') not like 'fixture/%' then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
  if has_pin and not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin where pin.config_id=(p_result->'pin'->>'configId')::uuid and pin.revision=(p_result->'pin'->>'revision')::integer and pin.config_fingerprint=p_result->'pin'->>'fingerprint') then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
  evaluation:=private.review_evaluation(p_result->'evaluation',case when r.examples_opened_at is null then 'none' else 'model_answer' end);
  payload:=jsonb_build_object('reviewTaskId',r.id,'practiceTaskId',t.id,'scenarioVersion',t.scenario_version,'scenarioFingerprint',t.scenario_fingerprint,'responseChinese',p_input->>'responseChinese',
   'accuracyScore',evaluation->'accuracy'->'score','accuracyFeedbackEnglish',evaluation->'accuracy'->>'englishFeedback',
   'naturalnessScore',evaluation->'naturalness'->'score','naturalnessFeedbackEnglish',evaluation->'naturalness'->>'englishFeedback',
   'contextualFitScore',evaluation->'contextualFit'->'score','contextualFitFeedbackEnglish',evaluation->'contextualFit'->>'englishFeedback',
   'completedAt',p_result->>'submittedAt','coaching',p_result->'coaching',
   'evaluationPromptVersion',case when has_pin then p_result->>'promptVersion' end,'evaluationModel',case when has_pin then p_result->>'model' end,
   'evaluationGatewayConfigId',p_result->'pin'->>'configId','evaluationGatewayRevision',p_result->'pin'->'revision','evaluationGatewayFingerprint',p_result->'pin'->>'fingerprint');
  result:=public.complete_due_review_with_snapshot(p_user_id,payload);
 end if;
 update private.review_operations set status='succeeded',response=result,updated_at=p_now where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid;
 return result;
end $$;

do $$declare f regprocedure;
begin
 foreach f in array array['public.lookup_review_completion(uuid,uuid,jsonb,timestamptz)'::regprocedure,'public.claim_review_completion(uuid,uuid,jsonb,timestamptz)'::regprocedure,'public.publish_review_completion(uuid,uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
