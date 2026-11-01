alter table public.attempts add column review_scenario_version integer,add column review_scenario_fingerprint text;
alter table public.attempts add constraint attempt_review_snapshot_check check((review_scenario_version is null and review_scenario_fingerprint is null) or (review_scenario_version>0 and review_scenario_fingerprint ~ '^[a-f0-9]{64}$'));

create function private.require_review_revision(p_user_id uuid,p_review_task_id uuid,p_input jsonb) returns void
language plpgsql stable set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.review_tasks r join public.practice_tasks t on t.review_task_id=r.id and t.user_id=p_user_id and t.user_expression_id=r.user_expression_id and t.kind='due_practice'
  join public.attempts a on a.id=r.completed_attempt_id and a.user_id=p_user_id and a.practice_task_id=t.id and a.user_expression_id=r.user_expression_id
  where r.id=p_review_task_id and r.user_id=p_user_id and r.status='completed' and t.id::text=p_input->>'taskId' and t.scenario_version=(p_input->>'scenarioVersion')::integer and t.scenario_fingerprint=p_input->>'scenarioFingerprint' and a.id::text=p_input->>'attemptId') then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
end $$;
revoke all on function private.require_review_revision(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.lookup_review_revision(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_now timestamptz default statement_timestamp()) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare op private.review_operations%rowtype;
begin
 perform private.require_review_revision(p_user_id,p_review_task_id,p_input);
 select * into op from private.review_operations where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid;
 if not found then return null;end if;
 if op.review_task_id<>p_review_task_id or op.kind<>'revision' or op.request_hash<>private.review_request_hash('revision',p_review_task_id,p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status='succeeded' then return jsonb_build_object('kind','ready','response',op.response);end if;
 if op.status='failed' then return jsonb_build_object('kind','failed','code',op.error_code);end if;
 if op.lease_expires_at<=p_now then return jsonb_build_object('kind','failed','code','PROVIDER_UNAVAILABLE');end if;
 return jsonb_build_object('kind','pending');
end $$;

create function public.claim_review_revision(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare existing jsonb;token uuid:=gen_random_uuid();
begin
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid review revision clock';end if;
 perform 1 from public.review_tasks where id=p_review_task_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='22023',message='owned review not found';end if;
 perform private.require_review_revision(p_user_id,p_review_task_id,p_input);
 existing:=public.lookup_review_revision(p_user_id,p_review_task_id,p_input,p_now);
 if existing is not null then
  if existing->>'kind'='failed' then raise exception using errcode='P0001',message=coalesce(existing->>'code','PROVIDER_UNAVAILABLE');end if;
  return existing;
 end if;
 insert into private.review_operations(user_id,review_task_id,request_id,kind,request_hash,status,claim_token,lease_expires_at,expected_version,expected_fingerprint,created_at,updated_at)
 values(p_user_id,p_review_task_id,(p_input->>'requestId')::uuid,'revision',private.review_request_hash('revision',p_review_task_id,p_input),'claimed',token,p_now+interval '5 minutes',(p_input->>'scenarioVersion')::integer,p_input->>'scenarioFingerprint',p_now,p_now);
 return jsonb_build_object('kind','claimed','token',token);
end $$;

create function private.review_evaluation(p_evaluation jsonb,p_assistance text) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
declare dimension text;score numeric;passed boolean:=true;dimension_value jsonb;result jsonb:='{}';
begin
 if p_assistance not in('none','model_answer') then raise exception using errcode='22023',message='invalid revision assistance';end if;
 foreach dimension in array array['accuracy','naturalness','contextualFit'] loop
  dimension_value:=p_evaluation->dimension;
  if jsonb_typeof(dimension_value->'score') is distinct from 'number' or jsonb_typeof(dimension_value->'englishFeedback') is distinct from 'string' then raise exception using errcode='22023',message='invalid revision evaluation';end if;
  score:=(dimension_value->>'score')::numeric;
  if score not between 1 and 5 or trunc(score)<>score or not private.is_learning_card_prose(dimension_value->>'englishFeedback',2000) then raise exception using errcode='22023',message='invalid revision evaluation';end if;
  passed:=passed and score>=3;
  result:=result||jsonb_build_object(dimension,jsonb_build_object('score',score,'englishFeedback',dimension_value->>'englishFeedback'));
 end loop;
 return result||jsonb_build_object('passed',passed,'independentUse',passed and p_assistance='none','assistanceLevel',p_assistance);
end $$;
revoke all on function private.review_evaluation(jsonb,text) from public,anon,authenticated,service_role;

create function public.publish_review_revision(p_user_id uuid,p_review_task_id uuid,p_input jsonb,p_token uuid,p_result jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;op private.review_operations%rowtype;revision public.review_revisions%rowtype;evaluation jsonb;coaching jsonb:=p_result->'coaching';assistance text;expected_prompt text;
begin
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid review revision clock';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found then raise exception using errcode='22023',message='owned review not found';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice' for update;
 perform private.require_review_revision(p_user_id,r.id,p_input);
 select * into op from private.review_operations where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid for update;
 if op.review_task_id<>r.id or op.kind<>'revision' or op.request_hash<>private.review_request_hash('revision',r.id,p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status='succeeded' then return op.response;end if;
 if op.status is distinct from 'claimed' or op.claim_token is distinct from p_token or op.lease_expires_at<=p_now then raise exception using errcode='P0001',message='JOB_LEASE_CONFLICT';end if;
 assistance:=case when r.examples_opened_at is null then 'none' else 'model_answer' end;
 evaluation:=private.review_evaluation(p_result->'evaluation',assistance);
 if evaluation->'accuracy'->>'score'='5' and evaluation->'naturalness'->>'score'='5' and evaluation->'contextualFit'->>'score'='5' then coaching:=null;end if;
 if coaching='null'::jsonb then coaching:=null;end if;
 if coaching is not null and (jsonb_typeof(coaching) is distinct from 'object' or jsonb_typeof(coaching->'naturalRevisionChinese') is distinct from 'string' or not private.is_target_chinese(coaching->>'naturalRevisionChinese',10000) or strpos(coaching->>'naturalRevisionChinese',t.target_expression)=0) then raise exception using errcode='22023',message='invalid revision coaching';end if;
 expected_prompt:=case when t.scenario_metadata_mode='modern' then 'evaluate-practice-v5' else 'evaluate-practice-v4' end;
 if p_result->>'promptVersion' is distinct from expected_prompt then raise exception using errcode='22023',message='invalid revision prompt version';end if;
 if (p_result->'pin' is null or p_result->'pin'='null'::jsonb) and coalesce(p_result->>'model','') not like 'fixture/%' then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
 if p_result->'pin' is not null and p_result->'pin'<>'null'::jsonb and not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin where pin.config_id=(p_result->'pin'->>'configId')::uuid and pin.revision=(p_result->'pin'->>'revision')::integer and pin.config_fingerprint=p_result->'pin'->>'fingerprint') then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
 insert into public.review_revisions(user_id,request_id,review_task_id,attempt_id,practice_task_id,user_expression_id,scenario_version,scenario_fingerprint,response_chinese,evaluation,coaching,evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,evaluation_gateway_revision,evaluation_gateway_fingerprint,created_at)
 values(p_user_id,(p_input->>'requestId')::uuid,r.id,r.completed_attempt_id,t.id,r.user_expression_id,t.scenario_version,t.scenario_fingerprint,p_input->>'responseChinese',evaluation,coaching,expected_prompt,p_result->>'model',(p_result->'pin'->>'configId')::uuid,(p_result->'pin'->>'revision')::integer,p_result->'pin'->>'fingerprint',p_now) returning * into revision;
 update private.review_operations set status='succeeded',response=to_jsonb(revision),updated_at=p_now where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid;
 return to_jsonb(revision);
end $$;

-- The old atomic completion/receipt/mastery/schedule path remains authoritative.
-- This outer transaction binds the scored question snapshot and persists its
-- coaching only on first creation; replay never overwrites historical feedback.
create function public.complete_due_review_with_snapshot(p_user_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;result jsonb;attempt_uuid uuid;official_coaching jsonb:=p_input->'coaching';
begin
 select * into r from public.review_tasks where user_id=p_user_id and id=(p_input->>'reviewTaskId')::uuid for update;
 if not found then raise exception using errcode='22023',message='owned review not found';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice' for update;
 if t.id is null or t.id::text is distinct from p_input->>'practiceTaskId' or t.scenario_version is distinct from (p_input->>'scenarioVersion')::integer or t.scenario_fingerprint is distinct from p_input->>'scenarioFingerprint' then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 if r.status='cancelled' then raise exception using errcode='22023',message='owned review not found';end if;
 result:=public.complete_due_practice_with_examples(p_user_id,p_input);
 if (result->'completion'->>'created')::boolean then
  attempt_uuid:=(result->'completion'->>'attempt_id')::uuid;
  if (p_input->>'accuracyScore')::integer=5 and (p_input->>'naturalnessScore')::integer=5 and (p_input->>'contextualFitScore')::integer=5 then official_coaching:=null;end if;
  if official_coaching='null'::jsonb then official_coaching:=null;end if;
  if official_coaching is not null and (jsonb_typeof(official_coaching->'naturalRevisionChinese') is distinct from 'string' or not private.is_target_chinese(official_coaching->>'naturalRevisionChinese',10000) or strpos(official_coaching->>'naturalRevisionChinese',t.target_expression)=0) then raise exception using errcode='22023',message='invalid official coaching';end if;
  update public.attempts set coaching=official_coaching,review_scenario_version=t.scenario_version,review_scenario_fingerprint=t.scenario_fingerprint where user_id=p_user_id and id=attempt_uuid and practice_task_id=t.id;
 end if;
 return result;
end $$;

do $$declare f regprocedure;
begin
 foreach f in array array['public.lookup_review_revision(uuid,uuid,jsonb,timestamptz)'::regprocedure,'public.claim_review_revision(uuid,uuid,jsonb,timestamptz)'::regprocedure,'public.publish_review_revision(uuid,uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure,'public.complete_due_review_with_snapshot(uuid,jsonb)'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
