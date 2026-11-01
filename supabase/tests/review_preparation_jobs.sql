begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59600000-0000-4000-8000-000000000001','59600000-0000-4000-8000-000000000002')),0,'previous lifecycle test transactions leave neither fixture owner behind');

-- B4 lifecycle rollback fixtures. All UUID families are 596*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59600000-0000-4000-8000-000000000001','review-completion-a@popcorn.test','authenticated','authenticated'),
 ('59600000-0000-4000-8000-000000000002','review-completion-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59600000-0000-4000-8000-000000000001'),('59600000-0000-4000-8000-000000000002') on conflict do nothing;

create function pg_temp.history_answer(draft uuid,answer uuid,score integer,at_time timestamptz) returns jsonb language sql as $$
 select jsonb_build_object('id',answer,'user_id',d.user_id,'practice_draft_id',d.id,'future_user_expression_id',d.future_user_expression_id,
 'revision',1,'response_chinese','这里高得要命。','accuracy_score',4,'accuracy_feedback_english','Accurate.',
 'naturalness_score',score,'naturalness_feedback_english','Check wording.','contextual_fit_score',4,'contextual_fit_feedback_english','Fits.',
 'submitted_at',at_time,'created_at',at_time) from public.practice_drafts d where d.id=draft
$$;

do $$
declare n integer;r integer;owner uuid;source uuid;snapshot uuid;save uuid;artifact uuid;draft uuid;future uuid;answer uuid;candidate jsonb;receipt record;video text;prompt text;rounds integer;
begin
 for n in 1..3 loop
  owner:=case when n=3 then '59600000-0000-4000-8000-000000000002'::uuid else '59600000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59610000',n);snapshot:=pg_temp.history_id('59620000',n);save:=pg_temp.history_id('59630000',n);artifact:=pg_temp.history_id('59640000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59690000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
    '{"segmentId":"history-segment","originalChinese":"这里的价格高得要命。","startSeconds":1,"endSeconds":2,"contextBefore":[],"contextAfter":[]}');
  candidate:=jsonb_build_object('expression','高得要命','englishMeaning','Outrageously high.','englishExplanation','Complain about excessive prices.',
   'tone','Casual.','communicativeFunction','Complain','register','Casual chat','highlightKey','history-stable-mark',
   'evidenceText','这里的价格高得要命。','segmentIds',jsonb_build_array('history-segment'),'startSeconds',1,'endSeconds',2,
   'meaningHere',case n when 1 then 'Canonical price complaint.' when 2 then 'Different candidate meaning.' else 'Other owner meaning.' end,
   'useItWhen','Complain about excessive prices.','comparedWith','很高 is neutral.','howItFits','After an adjective.','toneAndWho','Casual with friends.',
   'watchOut',null,'examples',null,'functionCategories',jsonb_build_array('complain'),'usageSettings',jsonb_build_array('casual_chat'),'suitability','expression');
  insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
   values(artifact,owner,source,save,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(candidate)),'analyze-saved-item-v3','fixture/history',repeat(md5(artifact::text),2),'2026-10-01T01:00:00Z');
  rounds:=case when n=1 then 4 else 1 end;
  for r in 1..rounds loop
   draft:=pg_temp.history_id('59650000',n*10+r);future:=pg_temp.history_id('59660000',n*10+r);answer:=pg_temp.history_id('59670000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59650000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
   if n=1 and r=1 then
    perform public.record_practice_round_attempt(owner,pg_temp.history_answer(draft,answer,2,'2026-10-01T03:00:00Z'));
    update public.practice_drafts set status='superseded' where id=draft;
   elsif r=rounds then
    perform public.record_practice_round_attempt(owner,pg_temp.history_answer(draft,answer,4,'2026-10-01T04:00:00Z'));
   end if;
  end loop;
  select * into strict receipt from private.practice_promotion_receipts p where p.user_id=owner and p.practice_draft_id=draft;
  insert into history_graph values(case n when 1 then 'main' when 2 then 'same_word_candidate' else 'other_owner' end,owner,source,save,artifact,draft,future,receipt.expression_sense_id,receipt.review_task_id,answer,(select d.candidate_key from public.practice_drafts d where d.id=draft),candidate);
 end loop;
end $$;

create function pg_temp.lifecycle_generated(zh text,direction text default 'near') returns jsonb language sql as $$
 select jsonb_build_object('scenario',jsonb_build_object('situationZh',zh,'situationEn','A coworker describes an unexpectedly expensive service and asks what you think.','interlocutor','同事','taskEn','Complain about the excessive price.'),
 'targetFunction',jsonb_build_object('value','complain','label','Complain','rule','Express dissatisfaction.'),
 'targetSetting',jsonb_build_object('value','work_school','label','Work & school','description','Talking with colleagues.'),
 'transferType',direction,'promptVersion','transfer-scenario-v1','model','fixture/review-completion','pin',null)
$$;
create function pg_temp.lifecycle_identity(review uuid,request uuid) returns jsonb language sql as $$
 select jsonb_build_object('taskId',id,'scenarioVersion',scenario_version,'scenarioFingerprint',scenario_fingerprint,'requestId',request) from public.practice_tasks where review_task_id=review
$$;



select extensions.is((select count(*)::integer from public.knowledge_jobs where job_type='prepare_transfer_task' and user_id in(select owner_id from history_graph)),3,'committed review schedules enqueue one prepare job each');
select extensions.ok(not exists(select 1 from public.knowledge_jobs j join history_graph g on j.video_source_id=g.source_id where j.job_type='prepare_transfer_task' and (j.saved_item_id is not null or j.user_id<>g.owner_id)),'outbox carries actual source owner and never a Saved item mutation');
select extensions.is((select count(*)::integer from public.knowledge_job_internal i join public.knowledge_jobs j on j.id=i.knowledge_job_id join history_graph g on (i.input->>'reviewTaskId')::uuid=g.review_id where j.job_type='prepare_transfer_task' and i.input->>'kind'='prepare_transfer_task'),3,'outbox input binds the real review id');

create temp table worker_ops(name text primary key,value jsonb);
insert into worker_ops select 'foreground',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('596f0000',1),null,null,'2026-11-01T00:00:00Z') from history_graph where name='main';
select extensions.ok((select public.fail_review_operation(owner_id,review_id,pg_temp.history_id('596f0000',1),(select (value->>'token')::uuid from worker_ops where name='foreground'),'PROVIDER_OUTPUT_INVALID','2026-11-01T00:00:01Z') from history_graph where name='main'),'foreground format exhaustion is durable');
update public.knowledge_jobs set status='leased',attempt_count=1,lease_expires_at='2026-11-01T00:05:00Z' where job_type='prepare_transfer_task' and video_source_id=(select source_id from history_graph where name='main');
insert into worker_ops select 'late_job',public.claim_review_preparation(g.owner_id,g.review_id,'prepare',j.id,null,jsonb_build_object('jobId',j.id,'attemptCount',1,'leaseExpiresAt',j.lease_expires_at),'2026-11-01T00:00:02Z') from history_graph g join public.knowledge_jobs j on j.video_source_id=g.source_id and j.job_type='prepare_transfer_task' where g.name='main';
select extensions.is((select value->>'kind' from worker_ops where name='late_job'),'failed','late job observes failed foreground cycle instead of claiming another model cycle');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on o.review_task_id=g.review_id where g.name='main' and o.status='claimed'),0,'late job creates no live generation claim');
select extensions.ok(not public.finish_review_preparation_job('59600000-0000-4000-8000-000000000002',j.id,1,j.lease_expires_at,'terminal_failed',jsonb_build_object('errorCode','PROVIDER_OUTPUT_INVALID'),'2026-11-01T00:00:03Z'),'foreign owner cannot finish job') from public.knowledge_jobs j join history_graph g on j.video_source_id=g.source_id where g.name='main' and j.job_type='prepare_transfer_task';
select extensions.ok(public.finish_review_preparation_job(j.user_id,j.id,1,j.lease_expires_at,'terminal_failed',jsonb_build_object('errorCode','PROVIDER_OUTPUT_INVALID'),'2026-11-01T00:00:03Z'),'matching live fence can record terminal failure') from public.knowledge_jobs j join history_graph g on j.video_source_id=g.source_id where g.name='main' and j.job_type='prepare_transfer_task';
select extensions.is((select count(*)::integer from public.claim_knowledge_jobs(25,'2026-11-01T00:10:00Z') where video_source_id=(select source_id from history_graph where name='main')),0,'failed review preparation job cannot be leased for a second durable model cycle');
select extensions.ok(not has_function_privilege('authenticated','public.finish_review_preparation_job(uuid,uuid,integer,timestamptz,text,jsonb,timestamptz)','EXECUTE'),'authenticated cannot execute private worker publication');
select extensions.ok(not has_function_privilege('anon','public.finish_review_preparation_job(uuid,uuid,integer,timestamptz,text,jsonb,timestamptz)','EXECUTE'),'anonymous cannot execute private worker publication');
select extensions.ok(has_function_privilege('service_role','public.finish_review_preparation_job(uuid,uuid,integer,timestamptz,text,jsonb,timestamptz)','EXECUTE'),'only service worker may finish');
insert into worker_ops select 'background',public.claim_review_preparation(g.owner_id,g.review_id,'prepare',j.id,null,jsonb_build_object('jobId',j.id,'attemptCount',j.attempt_count,'leaseExpiresAt',j.lease_expires_at),'2026-11-01T00:10:01Z') from history_graph g join public.knowledge_jobs j on j.video_source_id=g.source_id and j.job_type='prepare_transfer_task' where g.name='same_word_candidate';
select extensions.is((select value->>'kind' from worker_ops where name='background'),'claimed','first background delivery claims one initial cycle');
select extensions.ok((select public.fail_review_operation(g.owner_id,g.review_id,j.id,(select (value->>'token')::uuid from worker_ops where name='background'),'PROVIDER_OUTPUT_INVALID','2026-11-01T00:10:02Z') from history_graph g join public.knowledge_jobs j on j.video_source_id=g.source_id and j.job_type='prepare_transfer_task' where g.name='same_word_candidate'),'background format failure is persisted');
select extensions.is((select public.lookup_review_preparation(owner_id,review_id,'prepare',null,null,'2026-11-01T00:10:03Z')->>'kind' from history_graph where name='same_word_candidate'),'failed','plain GET after background failure only observes the same failed cycle');
select extensions.ok((select deleted from public.delete_video_source((select owner_id from history_graph where name='same_word_candidate'),(select source_id from history_graph where name='same_word_candidate'),'remove_source_keep_evidence','2026-11-01T00:11:00Z')),'source deletion is not blocked by background operation job foreign keys');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on o.review_task_id=g.review_id where g.name='same_word_candidate' and o.job_id is not null),0,'source deletion detaches only operational job reference');
select * from extensions.finish();
rollback;
