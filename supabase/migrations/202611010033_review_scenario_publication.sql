create function private.set_review_scenario_fingerprint() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.kind='due_practice' then new.scenario_fingerprint:=private.practice_situation_fingerprint(new.prompt_chinese);end if;
 return new;
end $$;
revoke all on function private.set_review_scenario_fingerprint() from public,anon,authenticated,service_role;
create trigger review_scenario_hash_set before insert or update of prompt_chinese on public.practice_tasks for each row execute function private.set_review_scenario_fingerprint();

create function private.review_request_hash(p_kind text,p_review uuid,p_input jsonb) returns text
language sql immutable set search_path=pg_catalog as $$
 select encode(extensions.digest(convert_to(jsonb_build_array(p_kind,p_review,p_input)::text,'UTF8'),'sha256'),'hex')
$$;
revoke all on function private.review_request_hash(text,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.lookup_review_preparation(p_user_id uuid,p_review_task_id uuid,p_kind text,p_request_id uuid,p_identity jsonb,p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare op private.review_operations%rowtype;original_id uuid;
begin
 if p_kind not in('prepare','regenerate') or not exists(select 1 from public.review_tasks where user_id=p_user_id and id=p_review_task_id) then return null;end if;
 if p_request_id is null then
  select * into op from private.review_operations where user_id=p_user_id and review_task_id=p_review_task_id and kind=p_kind order by created_at desc,request_id desc limit 1;
 else
  select * into op from private.review_operations where user_id=p_user_id and request_id=p_request_id;
 end if;
 if not found then return null;end if;
 if op.review_task_id<>p_review_task_id or op.kind<>p_kind or op.request_hash<>private.review_request_hash(p_kind,p_review_task_id,p_identity) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 original_id:=op.request_id;
 if op.status='waiting' then select * into op from private.review_operations where user_id=p_user_id and request_id=op.linked_request_id;end if;
 if op.status='succeeded' then return jsonb_build_object('kind','ready','requestId',original_id);end if;
 if op.status='failed' then return jsonb_build_object('kind','failed','requestId',original_id,'code',op.error_code);end if;
 if op.status='claimed' and op.lease_expires_at<=p_now then return jsonb_build_object('kind','failed','requestId',original_id,'code','PROVIDER_UNAVAILABLE');end if;
 return jsonb_build_object('kind','pending','requestId',original_id);
end $$;

create function public.claim_review_preparation(p_user_id uuid,p_review_task_id uuid,p_kind text,p_request_id uuid,p_identity jsonb,p_job jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;op private.review_operations%rowtype;existing jsonb;request_uuid uuid:=coalesce(p_request_id,gen_random_uuid());token uuid:=gen_random_uuid();
begin
 if p_kind not in('prepare','regenerate') or p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid review preparation';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found or r.status='cancelled' then raise exception using errcode='22023',message='owned review not found';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice' for update;
 if p_kind='prepare' and t.id is not null then return jsonb_build_object('kind','ready');end if;
 if p_kind='regenerate' then
  if r.status='completed' then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
  if t.id is null or t.id::text is distinct from p_identity->>'taskId' or t.scenario_version is distinct from (p_identity->>'scenarioVersion')::integer or t.scenario_fingerprint is distinct from p_identity->>'scenarioFingerprint' then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 end if;
 existing:=public.lookup_review_preparation(p_user_id,r.id,p_kind,p_request_id,p_identity,p_now);
 if existing is not null then return existing;end if;
 if r.status<>'pending' then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
 if p_kind='regenerate' and t.regenerated then raise exception using errcode='P0001',message='REGENERATE_USED';end if;
 update private.review_operations set status='failed',error_code='PROVIDER_UNAVAILABLE',updated_at=p_now where user_id=p_user_id and review_task_id=r.id and kind in('prepare','regenerate') and status='claimed' and lease_expires_at<=p_now;
 select * into op from private.review_operations where user_id=p_user_id and review_task_id=r.id and kind in('prepare','regenerate') and status='claimed' for update;
 if found then
  insert into private.review_operations(user_id,review_task_id,request_id,kind,request_hash,status,expected_version,expected_fingerprint,linked_request_id,created_at,updated_at)
  values(p_user_id,r.id,request_uuid,p_kind,private.review_request_hash(p_kind,r.id,p_identity),'waiting',coalesce(t.scenario_version,0),t.scenario_fingerprint,op.request_id,p_now,p_now);
  return jsonb_build_object('kind','pending','requestId',request_uuid);
 end if;
 if p_job is not null and not exists(select 1 from public.knowledge_jobs j where j.id=(p_job->>'jobId')::uuid and j.user_id=p_user_id and j.status='leased' and j.attempt_count=(p_job->>'attemptCount')::integer and j.lease_expires_at=(p_job->>'leaseExpiresAt')::timestamptz and j.lease_expires_at>p_now) then raise exception using errcode='P0001',message='JOB_LEASE_CONFLICT';end if;
 insert into private.review_operations(user_id,review_task_id,request_id,kind,request_hash,status,claim_token,lease_expires_at,expected_version,expected_fingerprint,job_id,job_attempt_count,job_lease_expires_at,created_at,updated_at)
 values(p_user_id,r.id,request_uuid,p_kind,private.review_request_hash(p_kind,r.id,p_identity),'claimed',token,p_now+interval '5 minutes',coalesce(t.scenario_version,0),t.scenario_fingerprint,(p_job->>'jobId')::uuid,(p_job->>'attemptCount')::integer,(p_job->>'leaseExpiresAt')::timestamptz,p_now,p_now);
 return jsonb_build_object('kind','claimed','requestId',request_uuid,'token',token,'expectedVersion',coalesce(t.scenario_version,0),'leaseExpiresAt',p_now+interval '5 minutes');
end $$;

create function public.publish_review_scenario(p_user_id uuid,p_review_task_id uuid,p_request_id uuid,p_token uuid,p_generated jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;op private.review_operations%rowtype;scenario jsonb:=p_generated->'scenario';sense public.expression_senses%rowtype;fingerprint text;field text;new_version integer;task_uuid uuid;
begin
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid review publication clock';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found then raise exception using errcode='22023',message='owned review not found';end if;
 perform pg_advisory_xact_lock(hashtextextended('review:'||p_user_id::text||':'||r.user_expression_id::text,0));
 select * into op from private.review_operations where user_id=p_user_id and review_task_id=r.id and request_id=p_request_id for update;
 if op.status='succeeded' then return op.response;end if;
 if op.status is distinct from 'claimed' or op.claim_token is distinct from p_token or op.lease_expires_at<=p_now then raise exception using errcode='P0001',message='JOB_LEASE_CONFLICT';end if;
 if r.status<>'pending' then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice' for update;
 if coalesce(t.scenario_version,0)<>op.expected_version or t.scenario_fingerprint is distinct from op.expected_fingerprint then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 if op.kind='regenerate' and t.regenerated then raise exception using errcode='P0001',message='REGENERATE_USED';end if;
 if op.job_id is not null and not exists(select 1 from public.knowledge_jobs j where j.id=op.job_id and j.user_id=p_user_id and j.status='leased' and j.attempt_count=op.job_attempt_count and j.lease_expires_at=op.job_lease_expires_at and j.lease_expires_at>p_now) then raise exception using errcode='P0001',message='JOB_LEASE_CONFLICT';end if;
 select s.* into sense from public.user_expressions e join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=p_user_id where e.user_id=p_user_id and e.id=r.user_expression_id;
 if sense.id is null then raise exception using errcode='22023',message='owned expression not found';end if;
 if p_generated->>'promptVersion' is distinct from 'transfer-scenario-v1' or p_generated->>'transferType' is null or p_generated->>'transferType' not in('near','far') then raise exception using errcode='22023',message='invalid transfer provenance';end if;
 if p_generated->'targetFunction'->>'value' is null or p_generated->'targetSetting'->>'value' is null then raise exception using errcode='22023',message='missing transfer target metadata';end if;
 if op.kind='regenerate' and t.transfer_type is not null and p_generated->>'transferType'<>t.transfer_type then raise exception using errcode='22023',message='regeneration changes transfer direction';end if;
 if (p_generated->'pin' is null or p_generated->'pin'='null'::jsonb) and coalesce(p_generated->>'model','') not like 'fixture/%' then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
 if jsonb_typeof(scenario) is distinct from 'object' or (select count(*) from jsonb_object_keys(scenario))<>4 then raise exception using errcode='22023',message='invalid review scenario';end if;
 foreach field in array array['situationZh','situationEn','interlocutor','taskEn'] loop
  if jsonb_typeof(scenario->field) is distinct from 'string' or length(btrim(scenario->>field))=0 or strpos(normalize(scenario->>field,NFKC),normalize(sense.expression_text,NFKC))>0 then raise exception using errcode='22023',message='invalid review scenario';end if;
 end loop;
 if not private.is_target_chinese(scenario->>'situationZh',10000) or char_length(scenario->>'situationZh')>120 or char_length(scenario->>'interlocutor')>10 or cardinality(regexp_split_to_array(btrim(scenario->>'situationEn'),'\s+'))>60 or cardinality(regexp_split_to_array(btrim(scenario->>'taskEn'),'\s+'))>30 then raise exception using errcode='22023',message='invalid review scenario';end if;
 fingerprint:=private.practice_situation_fingerprint(scenario->>'situationZh');
 if exists(select 1 from jsonb_array_elements_text(public.read_review_practice_context(p_user_id,r.id)->'history') history where private.practice_situation_fingerprint(history)=fingerprint) then raise exception using errcode='P0001',message='SCENARIO_DUPLICATE';end if;
 if p_generated->'pin' is not null and p_generated->'pin'<>'null'::jsonb and not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin where pin.config_id=(p_generated->'pin'->>'configId')::uuid and pin.revision=(p_generated->'pin'->>'revision')::integer and pin.config_fingerprint=p_generated->'pin'->>'fingerprint') then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
 if t.id is not null then
  insert into public.review_scenarios(user_id,review_task_id,practice_task_id,user_expression_id,scenario_version,scenario_fingerprint,context_fingerprint,prompt_chinese,snapshot,created_at)
  values(p_user_id,r.id,t.id,r.user_expression_id,t.scenario_version,t.scenario_fingerprint,t.context_fingerprint,t.prompt_chinese,to_jsonb(t),t.created_at) on conflict(user_id,review_task_id,scenario_version) do nothing;
  task_uuid:=t.id;new_version:=t.scenario_version+1;
  update public.practice_tasks set prompt_chinese=scenario->>'situationZh',instructions_english=scenario->>'taskEn',goal_english='Use the target expression naturally in this new situation.',situation_en=scenario->>'situationEn',interlocutor=scenario->>'interlocutor',task_en=scenario->>'taskEn',target_function=p_generated->'targetFunction'->>'value',target_setting=p_generated->'targetSetting'->>'value',transfer_type=p_generated->>'transferType',scenario_source='model',scenario_metadata_mode='modern',scenario_version=new_version,regenerated=true,scenario_prompt_version=p_generated->>'promptVersion',scenario_model=p_generated->>'model',scenario_gateway_config_id=(p_generated->'pin'->>'configId')::uuid,scenario_gateway_revision=(p_generated->'pin'->>'revision')::integer,scenario_gateway_fingerprint=p_generated->'pin'->>'fingerprint' where id=t.id and user_id=p_user_id returning * into t;
 else
  task_uuid:=gen_random_uuid();new_version:=1;
  insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,review_task_id,situation_en,interlocutor,task_en,target_function,target_setting,transfer_type,scenario_source,scenario_metadata_mode,scenario_prompt_version,scenario_model,scenario_gateway_config_id,scenario_gateway_revision,scenario_gateway_fingerprint)
  values(task_uuid,p_user_id,r.user_expression_id,'due_practice','en','zh-CN',sense.expression_text,scenario->>'situationZh',scenario->>'taskEn','Use the target expression naturally in this new situation.',r.due_at,r.id,scenario->>'situationEn',scenario->>'interlocutor',scenario->>'taskEn',p_generated->'targetFunction'->>'value',p_generated->'targetSetting'->>'value',p_generated->>'transferType','model','modern',p_generated->>'promptVersion',p_generated->>'model',(p_generated->'pin'->>'configId')::uuid,(p_generated->'pin'->>'revision')::integer,p_generated->'pin'->>'fingerprint') returning * into t;
 end if;
 insert into public.review_scenarios(user_id,review_task_id,practice_task_id,user_expression_id,scenario_version,scenario_fingerprint,context_fingerprint,prompt_chinese,snapshot,created_at)
 values(p_user_id,r.id,t.id,r.user_expression_id,t.scenario_version,t.scenario_fingerprint,t.context_fingerprint,t.prompt_chinese,to_jsonb(t),p_now);
 update private.review_operations set status='succeeded',response=jsonb_build_object('taskId',t.id),updated_at=p_now where user_id=p_user_id and request_id=p_request_id;
 return jsonb_build_object('taskId',t.id);
end $$;

create function public.fail_review_operation(p_user_id uuid,p_review_task_id uuid,p_request_id uuid,p_token uuid,p_code text,p_now timestamptz) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform 1 from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 update private.review_operations set status='failed',error_code=p_code,updated_at=p_now where user_id=p_user_id and review_task_id=p_review_task_id and request_id=p_request_id and claim_token=p_token and status='claimed' and lease_expires_at>p_now;
 return found;
end $$;

create function public.mark_review_disclosure(p_user_id uuid,p_review_task_id uuid,p_kind text,p_input jsonb,p_now timestamptz) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;t public.practice_tasks%rowtype;
begin
 if p_kind not in('reveal','examples') then raise exception using errcode='22023',message='invalid review marker';end if;
 select * into r from public.review_tasks where user_id=p_user_id and id=p_review_task_id for update;
 if not found or r.status='cancelled' then raise exception using errcode='22023',message='owned review not found';end if;
 select * into t from public.practice_tasks where user_id=p_user_id and review_task_id=r.id and kind='due_practice';
 if t.id is null or t.id::text is distinct from p_input->>'taskId' or t.scenario_version is distinct from (p_input->>'scenarioVersion')::integer or t.scenario_fingerprint is distinct from p_input->>'scenarioFingerprint' then raise exception using errcode='P0001',message='SCENARIO_CHANGED';end if;
 update public.review_tasks set expression_revealed_at=coalesce(expression_revealed_at,p_now),examples_opened_at=case when p_kind='examples' then coalesce(examples_opened_at,p_now) else examples_opened_at end where id=r.id and user_id=p_user_id;
 return true;
end $$;

do $$declare f regprocedure;
begin
 foreach f in array array['public.lookup_review_preparation(uuid,uuid,text,uuid,jsonb,timestamptz)'::regprocedure,'public.claim_review_preparation(uuid,uuid,text,uuid,jsonb,jsonb,timestamptz)'::regprocedure,'public.publish_review_scenario(uuid,uuid,uuid,uuid,jsonb,timestamptz)'::regprocedure,'public.fail_review_operation(uuid,uuid,uuid,uuid,text,timestamptz)'::regprocedure,'public.mark_review_disclosure(uuid,uuid,text,jsonb,timestamptz)'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
