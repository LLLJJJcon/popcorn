-- Commit-time outbox, one durable model cycle, and fenced worker finalization.
alter table public.knowledge_jobs drop constraint knowledge_job_type_check;
alter table public.knowledge_jobs add constraint knowledge_job_type_check check(job_type in(
 'resolve_snapshot','generate_overview','translate_segments','explain_selection','analyze_saved_item','highlight_saved_item','prepare_transfer_task'
));

create function private.enqueue_review_preparation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare source uuid;job uuid:=gen_random_uuid();clock timestamptz:=statement_timestamp();
begin
 if new.status<>'pending' then return new;end if;
 select s.video_source_id into source from public.user_expressions e join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=e.user_id where e.id=new.user_expression_id and e.user_id=new.user_id;
 -- A deleted source has no new generation surface. Lock its real row so a
 -- concurrent deletion cannot turn a legitimate schedule commit into a FK error.
 perform 1 from public.video_sources where id=source and user_id=new.user_id for key share;
 if not found then return new;end if;
 insert into public.knowledge_jobs(id,user_id,video_source_id,saved_item_id,job_type,dedupe_key,created_at,updated_at)
 values(job,new.user_id,source,null,'prepare_transfer_task',encode(extensions.digest(convert_to('prepare-transfer:'||new.id::text,'UTF8'),'sha256'),'hex'),clock,clock)
 on conflict(user_id,job_type,dedupe_key) do nothing;
 if found then
  insert into public.knowledge_job_internal(knowledge_job_id,user_id,input,created_at,updated_at)
  values(job,new.user_id,jsonb_build_object('kind','prepare_transfer_task','reviewTaskId',new.id),clock,clock);
 end if;
 return new;
end $$;
revoke all on function private.enqueue_review_preparation() from public,anon,authenticated,service_role;
create trigger review_preparation_outbox after insert on public.review_tasks for each row execute function private.enqueue_review_preparation();

-- Existing pending reviews without a task get the same owned outbox, without
-- changing their learning state, dates, source data, or existing ready question.
insert into public.knowledge_jobs(id,user_id,video_source_id,saved_item_id,job_type,dedupe_key)
select gen_random_uuid(),r.user_id,s.video_source_id,null,'prepare_transfer_task',encode(extensions.digest(convert_to('prepare-transfer:'||r.id::text,'UTF8'),'sha256'),'hex')
from public.review_tasks r join public.user_expressions e on e.id=r.user_expression_id and e.user_id=r.user_id
join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=r.user_id
join public.video_sources v on v.id=s.video_source_id and v.user_id=r.user_id
where r.status='pending' and not exists(select 1 from public.practice_tasks t where t.review_task_id=r.id and t.user_id=r.user_id)
on conflict(user_id,job_type,dedupe_key) do nothing;
insert into public.knowledge_job_internal(knowledge_job_id,user_id,input)
select j.id,j.user_id,jsonb_build_object('kind','prepare_transfer_task','reviewTaskId',r.id)
from public.knowledge_jobs j join public.review_tasks r on r.user_id=j.user_id and j.dedupe_key=encode(extensions.digest(convert_to('prepare-transfer:'||r.id::text,'UTF8'),'sha256'),'hex')
where j.job_type='prepare_transfer_task' on conflict(knowledge_job_id) do nothing;

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.claim_knowledge_jobs(integer,timestamptz)'::regprocedure);
 if strpos(definition,'job.attempt_count >= 5')=0 then raise exception 'Knowledge job attempt anchor missing';end if;
 execute replace(definition,'job.attempt_count >= 5', 'job.attempt_count >= case when job.job_type=''prepare_transfer_task'' then 1 else 5 end');
 definition:=pg_get_functiondef('public.claim_review_preparation(uuid,uuid,text,uuid,jsonb,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,'existing:=public.lookup_review_preparation(p_user_id,r.id,p_kind,p_request_id,p_identity,p_now);')=0 then raise exception 'Review background cycle anchor missing';end if;
 -- Background delivery is an observer of the initial/current cycle, never a
 -- user-authorized retry. This check is under the same review lock as claim.
 definition:=replace(definition,'existing:=public.lookup_review_preparation(p_user_id,r.id,p_kind,p_request_id,p_identity,p_now);',
 'existing:=public.lookup_review_preparation(p_user_id,r.id,p_kind,case when p_job is not null then null else p_request_id end,p_identity,p_now);');
 execute definition;
end $$;

create function public.finish_review_preparation_job(p_user_id uuid,p_job_id uuid,p_expected_attempt_count integer,p_expected_lease_expires_at timestamptz,p_status text,p_result jsonb,p_now timestamptz) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare j public.knowledge_jobs%rowtype;
begin
 if p_now is null or not isfinite(p_now) or p_status not in('succeeded','terminal_failed') or jsonb_typeof(p_result) is distinct from 'object' then raise exception using errcode='22023',message='invalid preparation job outcome';end if;
 if p_status='terminal_failed' and (p_result->>'errorCode' is null or length(btrim(p_result->>'errorCode')) not between 1 and 100) then raise exception using errcode='22023',message='invalid preparation job failure';end if;
 select * into j from public.knowledge_jobs where id=p_job_id and user_id=p_user_id and job_type='prepare_transfer_task' for update;
 if not found or j.status<>'leased' or j.attempt_count is distinct from p_expected_attempt_count or j.lease_expires_at is distinct from p_expected_lease_expires_at or j.lease_expires_at<=p_now then return false;end if;
 if p_status='succeeded' and not exists(
  select 1 from public.knowledge_job_internal i join public.practice_tasks t on t.review_task_id=(i.input->>'reviewTaskId')::uuid and t.user_id=i.user_id and t.kind='due_practice'
  where i.knowledge_job_id=j.id and i.user_id=p_user_id and t.id::text=p_result->>'taskId' and t.review_task_id::text=p_result->>'reviewTaskId'
 ) then return false;end if;
 update public.knowledge_jobs set status=p_status,next_attempt_at=null,lease_expires_at=null,last_error_code=case when p_status='terminal_failed' then p_result->>'errorCode' end,updated_at=p_now where id=j.id and user_id=p_user_id;
 update public.knowledge_job_internal set result=p_result,updated_at=p_now where knowledge_job_id=j.id and user_id=p_user_id;
 return true;
end $$;
revoke all on function public.finish_review_preparation_job(uuid,uuid,integer,timestamptz,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.finish_review_preparation_job(uuid,uuid,integer,timestamptz,text,jsonb,timestamptz) to service_role;

-- Source deletion may delete a completed worker record. Preserve immutable
-- review evidence and sever only the operational FK; an in-flight publisher
-- loses its claim and cannot publish after deletion.
create function private.detach_review_job() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 update private.review_operations set job_id=null,job_attempt_count=null,job_lease_expires_at=null,
 status=case when status='claimed' then 'failed' else status end,
 error_code=case when status='claimed' then 'PROVIDER_UNAVAILABLE' else error_code end,
 updated_at=statement_timestamp() where job_id=old.id and user_id=old.user_id;
 return old;
end $$;
revoke all on function private.detach_review_job() from public,anon,authenticated,service_role;
create trigger review_job_source_cleanup before delete on public.knowledge_jobs for each row execute function private.detach_review_job();
