begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59500000-0000-4000-8000-000000000001','59500000-0000-4000-8000-000000000002')),0,'previous lifecycle test transactions leave neither fixture owner behind');

-- B4 lifecycle rollback fixtures. All UUID families are 595*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59500000-0000-4000-8000-000000000001','review-completion-a@popcorn.test','authenticated','authenticated'),
 ('59500000-0000-4000-8000-000000000002','review-completion-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59500000-0000-4000-8000-000000000001'),('59500000-0000-4000-8000-000000000002') on conflict do nothing;

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
  owner:=case when n=3 then '59500000-0000-4000-8000-000000000002'::uuid else '59500000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59510000',n);snapshot:=pg_temp.history_id('59520000',n);save:=pg_temp.history_id('59530000',n);artifact:=pg_temp.history_id('59540000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59590000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
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
   draft:=pg_temp.history_id('59550000',n*10+r);future:=pg_temp.history_id('59560000',n*10+r);answer:=pg_temp.history_id('59570000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59550000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
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


create temp table completion_results(name text primary key,value jsonb);
create function pg_temp.completion_input(request_number integer,response text default '这个价格高得要命。') returns jsonb language sql as $$
 select pg_temp.lifecycle_identity(review_id,pg_temp.history_id('595f0000',request_number))||jsonb_build_object('responseChinese',response) from history_graph where name='main'
$$;
create function pg_temp.completion_score() returns jsonb language sql as $$
 select jsonb_build_object('evaluation',jsonb_build_object('passed',true,'independentUse',true,'assistanceLevel','none',
 'accuracy',jsonb_build_object('score',4,'englishFeedback','Accurate.'),'naturalness',jsonb_build_object('score',4,'englishFeedback','Natural.'),'contextualFit',jsonb_build_object('score',4,'englishFeedback','Fits.')),
 'coaching',jsonb_build_object('naturalRevisionChinese','这个收费真的高得要命。'),'promptVersion','evaluate-practice-v5','model','fixture/review-completion','pin',null,'submittedAt','2026-11-01T00:02:00Z')
$$;
insert into completion_results select 'prepare',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('595e0000',1),null,null,'2026-11-01T00:00:00Z') from history_graph where name='main';
insert into completion_results select 'ready',public.publish_review_scenario(g.owner_id,g.review_id,(o.value->>'requestId')::uuid,(o.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问公司食堂一份套餐两百元你怎么看。'),'2026-11-01T00:00:01Z') from history_graph g cross join completion_results o where g.name='main' and o.name='prepare';
insert into completion_results select 'input1',pg_temp.completion_input(1) from history_graph where name='main';
insert into completion_results select 'claim1',public.claim_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:00:02Z') from history_graph g cross join completion_results i where g.name='main' and i.name='input1';
select extensions.is((select value->>'kind' from completion_results where name='claim1'),'claimed','official scoring has one persisted request claim before model work');
select extensions.is((select public.claim_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:00:03Z')->>'kind' from history_graph g cross join completion_results i where g.name='main' and i.name='input1'),'pending','same UUID while scoring cannot start another model cycle');
select extensions.ok((select public.fail_review_operation(g.owner_id,g.review_id,(i.value->>'requestId')::uuid,(c.value->>'token')::uuid,'PROVIDER_OUTPUT_INVALID','2026-11-01T00:00:04Z') from history_graph g cross join completion_results i cross join completion_results c where g.name='main' and i.name='input1' and c.name='claim1'),'known model failure records only that operation');
select extensions.is((select public.lookup_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:00:05Z')->>'kind' from history_graph g cross join completion_results i where g.name='main' and i.name='input1'),'failed','same UUID reads the failed cycle without another claim');
select extensions.is((select count(*)::integer from public.attempts a join history_graph g on g.expression_id=a.user_expression_id where g.name='main'),1,'failed scoring wrote no official attempt');
insert into completion_results select 'input2',pg_temp.completion_input(2) from history_graph where name='main';
insert into completion_results select 'claim2',public.claim_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:01:00Z') from history_graph g cross join completion_results i where g.name='main' and i.name='input2';
select extensions.is((select value->>'kind' from completion_results where name='claim2'),'claimed','only a fresh explicit user request opens the next scoring cycle');
select extensions.throws_ok(format('select public.lookup_review_completion(%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.completion_input(2,'这个收费高得要命。'),'2026-11-01T00:01:01Z'),'P0001','IDEMPOTENCY_CONFLICT','same completion UUID cannot change learner text');
insert into completion_results select 'regen_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('595e0000',2)) from history_graph where name='main';
insert into completion_results select 'regen_claim',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('595e0000',2),i.value,null,'2026-11-01T00:01:02Z') from history_graph g cross join completion_results i where g.name='main' and i.name='regen_identity';
insert into completion_results select 'regen',public.publish_review_scenario(g.owner_id,g.review_id,(o.value->>'requestId')::uuid,(o.value->>'token')::uuid,pg_temp.lifecycle_generated('同事说打印一页表格竟然收费五十元，问你怎么看。'),'2026-11-01T00:01:03Z') from history_graph g cross join completion_results o where g.name='main' and o.name='regen_claim';
select extensions.throws_ok(format('select public.publish_review_completion(%L,%L,%L::jsonb,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),(select value from completion_results where name='input2'),(select value->>'token' from completion_results where name='claim2'),pg_temp.completion_score(),'2026-11-01T00:01:04Z'),'P0001','SCENARIO_CHANGED','a regeneration committed during scoring prevents old scores being written to the new scenario');
select extensions.is((select count(*)::integer from public.attempts a join history_graph g on g.expression_id=a.user_expression_id where g.name='main'),1,'scenario fence failure leaves the entire official attempt graph untouched');
insert into completion_results select 'input3',pg_temp.completion_input(3) from history_graph where name='main';
insert into completion_results select 'claim3',public.claim_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:02:00Z') from history_graph g cross join completion_results i where g.name='main' and i.name='input3';
select extensions.ok((select public.mark_review_disclosure(owner_id,review_id,'examples',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('595e0000',3)),'2026-11-01T00:02:01Z') from history_graph where name='main'),'examples can commit while the current answer is being scored');
insert into completion_results select 'official',public.publish_review_completion(g.owner_id,g.review_id,i.value,(c.value->>'token')::uuid,pg_temp.completion_score(),'2026-11-01T00:02:02Z') from history_graph g cross join completion_results i cross join completion_results c where g.name='main' and i.name='input3' and c.name='claim3';
select extensions.ok((select (value->'completion'->>'created')::boolean from completion_results where name='official'),'one official attempt publishes from the claimed current scenario');
select extensions.is((select value->>'assistanceLevel' from completion_results where name='official'),'model_answer','late examples is derived under the same final review lock');
select extensions.is((select (value->'completion'->>'interval_days')::integer from completion_results where name='official'),1,'server-assisted completion preserves the original one-day schedule rule');
select extensions.is((select count(*)::integer from public.attempts a join history_graph g on g.expression_id=a.user_expression_id where g.name='main'),2,'exactly the promotion and one official review attempt exist');
create temp table completion_official_before as select to_jsonb(a) attempt,to_jsonb(r) review,to_jsonb(receipt) receipt from history_graph g join public.review_tasks r on r.id=g.review_id join public.attempts a on a.id=r.completed_attempt_id join private.due_practice_completion_receipts receipt on receipt.review_task_id=r.id where g.name='main';
select extensions.is((select public.lookup_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:02:03Z')->>'kind' from history_graph g cross join completion_results i where g.name='main' and i.name='input3'),'ready','lost success responses replay a successful request instead of rescoring');
select extensions.is((select public.publish_review_completion(g.owner_id,g.review_id,i.value,(c.value->>'token')::uuid,pg_temp.completion_score(),'2026-11-01T00:02:04Z')->'completion'->>'attempt_id' from history_graph g cross join completion_results i cross join completion_results c where g.name='main' and i.name='input3' and c.name='claim3'),(select value->'completion'->>'attempt_id' from completion_results where name='official'),'same request publication returns the immutable official attempt');
select extensions.results_eq($$select to_jsonb(a),to_jsonb(r),to_jsonb(receipt) from history_graph g join public.review_tasks r on r.id=g.review_id join public.attempts a on a.id=r.completed_attempt_id join private.due_practice_completion_receipts receipt on receipt.review_task_id=r.id where g.name='main'$$,$$select * from completion_official_before$$,'same UUID replay cannot rewrite any official attempt/review/receipt field');
select extensions.ok((select deleted from public.delete_video_source((select owner_id from history_graph where name='main'),(select source_id from history_graph where name='main'),'remove_source_keep_evidence','2026-11-01T00:03:00Z')),'real source deletion retains the canonical official learning graph');
select extensions.is((select public.read_review_practice_context(owner_id,review_id)->'sense'->'video_source_id' from history_graph where name='main'),'null'::jsonb,'display source is truly deleted in the replay fixture');
select extensions.is((select public.lookup_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:03:01Z')->>'kind' from history_graph g cross join completion_results i where g.name='main' and i.name='input3'),'ready','source-deleted official request receipts remain replayable');
select extensions.is((select public.claim_review_completion(g.owner_id,g.review_id,i.value,'2026-11-01T00:03:02Z')->>'kind' from history_graph g cross join completion_results i where g.name='main' and i.name='input3'),'ready','source-deleted same-request replay does not require display material or a new scoring claim');
set local role authenticated;
select extensions.throws_ok($$select public.claim_review_completion('59500000-0000-4000-8000-000000000001','59500000-0000-4000-8000-000000000002','{}',now())$$,'42501',null,'authenticated clients cannot select their own official score publication');
reset role;
select * from extensions.finish();
rollback;
