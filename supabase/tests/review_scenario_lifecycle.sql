begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59200000-0000-4000-8000-000000000001','59200000-0000-4000-8000-000000000002')),0,'previous lifecycle test transactions leave neither fixture owner behind');

-- B4 lifecycle rollback fixtures. All UUID families are 592*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59200000-0000-4000-8000-000000000001','review-lifecycle-a@popcorn.test','authenticated','authenticated'),
 ('59200000-0000-4000-8000-000000000002','review-lifecycle-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59200000-0000-4000-8000-000000000001'),('59200000-0000-4000-8000-000000000002') on conflict do nothing;

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
  owner:=case when n=3 then '59200000-0000-4000-8000-000000000002'::uuid else '59200000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59210000',n);snapshot:=pg_temp.history_id('59220000',n);save:=pg_temp.history_id('59230000',n);artifact:=pg_temp.history_id('59240000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59290000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
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
   draft:=pg_temp.history_id('59250000',n*10+r);future:=pg_temp.history_id('59260000',n*10+r);answer:=pg_temp.history_id('59270000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59250000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
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

select extensions.is((select count(*)::integer from private.practice_promotion_receipts p join history_graph g on g.draft_id=p.practice_draft_id and g.owner_id=p.user_id),3,'three genuine promotion RPCs establish independent winning receipts');
select extensions.is((select count(*)::integer from public.practice_draft_attempts a join public.practice_drafts d on d.id=a.practice_draft_id where d.user_id='59200000-0000-4000-8000-000000000001' and a.naturalness_score=2),1,'history contains a genuinely failed first-round answer');

create function pg_temp.lifecycle_generated(zh text,direction text default 'near') returns jsonb language sql as $$
 select jsonb_build_object('scenario',jsonb_build_object('situationZh',zh,'situationEn','A coworker describes an unexpectedly expensive service and asks what you think.','interlocutor','同事','taskEn','Complain about the excessive price.'),
 'targetFunction',jsonb_build_object('value','complain','label','Complain','rule','Express dissatisfaction.'),
 'targetSetting',jsonb_build_object('value','work_school','label','Work & school','description','Talking with colleagues.'),
 'transferType',direction,'promptVersion','transfer-scenario-v1','model','fixture/review-lifecycle','pin',null)
$$;
create function pg_temp.lifecycle_identity(review uuid,request uuid) returns jsonb language sql as $$
 select jsonb_build_object('taskId',id,'scenarioVersion',scenario_version,'scenarioFingerprint',scenario_fingerprint,'requestId',request) from public.practice_tasks where review_task_id=review
$$;
create function pg_temp.lifecycle_require_ready(owner uuid,review uuid,kind text,request uuid,identity jsonb,at_time timestamptz) returns void language plpgsql as $$
declare result jsonb;
begin
 result:=public.claim_review_preparation(owner,review,kind,request,identity,null,at_time);
 if result->>'kind' is distinct from 'ready' then raise exception 'Expected ready replay, got %',result;end if;
end $$;
-- The repository may expose a terminal product conflict either as a typed failed
-- result or a matching SQL exception. A ready/pending/claimed alias is not one.
create function pg_temp.lifecycle_require_conflict(owner uuid,review uuid,request uuid,identity jsonb,at_time timestamptz,expected text,claim boolean default false) returns void language plpgsql as $$
declare result jsonb;
begin
 begin
  if claim then result:=public.claim_review_preparation(owner,review,'regenerate',request,identity,null,at_time);
  else result:=public.lookup_review_preparation(owner,review,'regenerate',request,identity,at_time);end if;
 exception when sqlstate 'P0001' then
  if sqlerrm=expected then return;end if;raise;
 end;
 if result->>'kind'='failed' and result->>'code'=expected then return;end if;
 raise exception 'Expected terminal % conflict, got %',expected,result;
end $$;
create temp table lifecycle_results(name text primary key,value jsonb);
create temp table lifecycle_official_before as select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id) attempts,
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id) mastery,
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id) expressions,
 (select jsonb_agg(to_jsonb(r)-'expression_revealed_at'-'examples_opened_at' order by r.id) from public.review_tasks r join history_graph g on g.review_id=r.id) schedules;

-- Initial preparation: one winner, distinct-tab aliases join its persisted cycle.
insert into lifecycle_results select 'initial',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',1),null,null,'2026-11-01T00:00:00Z') from history_graph where name='main';
select extensions.is((select value->>'kind' from lifecycle_results where name='initial'),'claimed','initial preparation acquires one generation claim');
insert into lifecycle_results select 'alias',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',2),null,null,'2026-11-01T00:00:01Z') from history_graph where name='main';
select extensions.is((select value->>'kind' from lifecycle_results where name='alias'),'pending','a second request coalesces instead of becoming another generation winner');
select extensions.is((select count(*)::integer from private.review_operations where user_id='59200000-0000-4000-8000-000000000001' and status='claimed'),1,'exactly one active claim exists across initial request aliases');
select extensions.throws_ok(format('select public.lookup_review_preparation(%L,%L,''prepare'',%L,''{}''::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',1),'2026-11-01T00:00:01Z'),'P0001','IDEMPOTENCY_CONFLICT','same request ID cannot change its preparation signature');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',1),pg_temp.history_id('592f0000',99),pg_temp.lifecycle_generated('同事问新午餐的价格怎么样。'),'2026-11-01T00:00:02Z'),'P0001','JOB_LEASE_CONFLICT','wrong publication token cannot use a valid claim');
insert into lifecycle_results select 'initial_publish',public.publish_review_scenario(g.owner_id,g.review_id,(r.value->>'requestId')::uuid,(r.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问新午餐的价格怎么样。'),'2026-11-01T00:00:02Z') from history_graph g cross join lifecycle_results r where g.name='main' and r.name='initial';
select extensions.is((select t.scenario_version from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main'),1,'first publication persists version one');
select extensions.is((select count(*)::integer from public.review_scenarios h join history_graph g on g.review_id=h.review_task_id where g.name='main'),1,'initial publication records one immutable scenario snapshot');
select extensions.is((select public.lookup_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',2),null,'2026-11-01T00:00:03Z')->>'kind' from history_graph where name='main'),'ready','waiting alias replays the published winner');
create temp table lifecycle_ready_before as select to_jsonb(t) task,(select jsonb_agg(to_jsonb(o) order by o.request_id) from private.review_operations o where o.review_task_id=t.review_task_id) operations from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main';
select extensions.is((select public.claim_review_preparation(owner_id,review_id,'prepare',null,null,null,'2026-11-01T00:00:04Z')->>'kind' from history_graph where name='main'),'ready','ready preparation returns without claiming another cycle');
select extensions.results_eq($$select to_jsonb(t),(select jsonb_agg(to_jsonb(o) order by o.request_id) from private.review_operations o where o.review_task_id=t.review_task_id) from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main'$$,$$select task,operations from lifecycle_ready_before$$,'ready SQL recovery makes no persisted task or operation change');

-- Marker writes persist before returning; reveal alone is not example assistance.
select extensions.ok((select public.mark_review_disclosure(owner_id,review_id,'reveal',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',3)),'2026-11-01T00:00:10Z') from history_graph where name='main'),'reveal marker succeeds after durable write');
select extensions.ok((select r.expression_revealed_at='2026-11-01T00:00:10Z' and r.examples_opened_at is null from public.review_tasks r join history_graph g on g.review_id=r.id where g.name='main'),'reveal alone persists recall disclosure without example assistance');
select extensions.ok((select public.mark_review_disclosure(owner_id,review_id,'examples',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',4)),'2026-11-01T00:00:11Z') from history_graph where name='main'),'examples marker succeeds');
select extensions.ok((select r.expression_revealed_at='2026-11-01T00:00:10Z' and r.examples_opened_at='2026-11-01T00:00:11Z' from public.review_tasks r join history_graph g on g.review_id=r.id where g.name='main'),'examples records assistance and retains the first reveal timestamp');
insert into lifecycle_results select 'failed_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',5)) from history_graph where name='main';
create temp table lifecycle_failed_before as select to_jsonb(t) task,to_jsonb(r) review from public.practice_tasks t join public.review_tasks r on r.id=t.review_task_id join history_graph g on g.review_id=r.id where g.name='main';
insert into lifecycle_results select 'failed_regen',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',5),i.value,null,'2026-11-01T00:01:00Z') from history_graph g cross join lifecycle_results i where g.name='main' and i.name='failed_identity';
insert into lifecycle_results select 'failed_waiter_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',50)) from history_graph where name='main';
insert into lifecycle_results select 'failed_waiter',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',50),i.value,null,'2026-11-01T00:01:00Z') from history_graph g cross join lifecycle_results i where g.name='main' and i.name='failed_waiter_identity';
select extensions.ok((select value->>'kind'='pending' and value->>'requestId'=pg_temp.history_id('592f0000',50)::text from lifecycle_results where name='failed_waiter'),'failed-cycle waiter initially retains its own pending request ID');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',5),(select value->>'token' from lifecycle_results where name='failed_regen'),pg_temp.lifecycle_generated(' 同事问新午餐的价格怎么样！ '),'2026-11-01T00:01:01Z'),'P0001','SCENARIO_DUPLICATE','normalized punctuation-only duplicate is rejected');
select extensions.ok((select public.fail_review_operation(g.owner_id,g.review_id,pg_temp.history_id('592f0000',5),(o.value->>'token')::uuid,'PROVIDER_OUTPUT_INVALID','2026-11-01T00:01:02Z') from history_graph g cross join lifecycle_results o where g.name='main' and o.name='failed_regen'),'known failed regeneration records only its request outcome');
select extensions.results_eq($$select to_jsonb(t),to_jsonb(r) from public.practice_tasks t join public.review_tasks r on r.id=t.review_task_id join history_graph g on g.review_id=r.id where g.name='main'$$,$$select task,review from lifecycle_failed_before$$,'failed regeneration preserves original question, version, both hashes, markers and allowance');
select extensions.is((select public.lookup_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',5),i.value,'2026-11-01T00:01:03Z')->>'kind' from history_graph g cross join lifecycle_results i where g.name='main' and i.name='failed_identity'),'failed','same failed request replays without starting another cycle');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''PROVIDER_OUTPUT_INVALID'',true)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',50),(select value from lifecycle_results where name='failed_waiter_identity'),'2026-11-01T00:01:03Z'),'failed regeneration waiter remains failed instead of automatically starting a new cycle');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on g.review_id=o.review_task_id where g.name='main' and o.status='claimed'),0,'failed winner and its waiter leave no new active generation cycle');

-- A fresh explicit retry may publish exactly one successful replacement.
insert into lifecycle_results select 'regen_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',6)) from history_graph where name='main';
insert into lifecycle_results select 'regen',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',6),i.value,null,'2026-11-01T00:02:00Z') from history_graph g cross join lifecycle_results i where g.name='main' and i.name='regen_identity';
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''PROVIDER_OUTPUT_INVALID'',true)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',50),(select value from lifecycle_results where name='failed_waiter_identity'),'2026-11-01T00:02:00Z'),'old failed waiter does not join a later explicit retry cycle');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on g.review_id=o.review_task_id where g.name='main' and o.status='claimed'),1,'only the fresh explicit retry is active while an old failed waiter replays');
insert into lifecycle_results select 'regen_waiter_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',60)) from history_graph where name='main';
insert into lifecycle_results select 'regen_waiter',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',60),i.value,null,'2026-11-01T00:02:00Z') from history_graph g cross join lifecycle_results i where g.name='main' and i.name='regen_waiter_identity';
select extensions.ok((select value->>'kind'='pending' and value->>'requestId'=pg_temp.history_id('592f0000',60)::text from lifecycle_results where name='regen_waiter'),'distinct replacement waiter retains its own request ID while the winner is pending');
select extensions.is((select public.lookup_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',60),i.value,'2026-11-01T00:02:01Z')->>'requestId' from history_graph g cross join lifecycle_results i where g.name='main' and i.name='regen_waiter_identity'),pg_temp.history_id('592f0000',60)::text,'polling a pending replacement waiter does not substitute the winner request ID');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',6),(select value->>'token' from lifecycle_results where name='regen'),pg_temp.lifecycle_generated('同事问打印一张表收费五十元合不合理。','far'),'2026-11-01T00:02:01Z'),'22023','regeneration changes transfer direction','replacement cannot silently change the actual transfer direction');
insert into lifecycle_results select 'regen_publish',public.publish_review_scenario(g.owner_id,g.review_id,(o.value->>'requestId')::uuid,(o.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问打印一张表收费五十元合不合理。'),'2026-11-01T00:02:02Z') from history_graph g cross join lifecycle_results o where g.name='main' and o.name='regen';
select extensions.ok((select t.scenario_version=2 and t.regenerated and t.transfer_type='near' from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main'),'only successful replacement increments version and consumes one allowance');
select extensions.is((select count(*)::integer from public.review_scenarios h join history_graph g on g.review_id=h.review_task_id where g.name='main'),2,'regeneration archives the old question once and records the new question');
select extensions.ok((select r.expression_revealed_at='2026-11-01T00:00:10Z' and r.examples_opened_at='2026-11-01T00:00:11Z' from public.review_tasks r join history_graph g on g.review_id=r.id where g.name='main'),'replacement inherits persisted disclosure and example markers');
create temp table lifecycle_success_before as select to_jsonb(t) task,(select jsonb_agg(to_jsonb(o) order by o.request_id) from private.review_operations o where o.review_task_id=t.review_task_id) operations,(select jsonb_agg(to_jsonb(h) order by h.scenario_version) from public.review_scenarios h where h.review_task_id=t.review_task_id) scenarios from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main';
select extensions.is((select public.publish_review_scenario(g.owner_id,g.review_id,pg_temp.history_id('592f0000',6),(o.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问打印一张表收费五十元合不合理。'),'2026-11-01T00:02:03Z') from history_graph g cross join lifecycle_results o where g.name='main' and o.name='regen'),(select value from lifecycle_results where name='regen_publish'),'winner same-ID publication response loss replays its exact task receipt');
select extensions.is((select public.lookup_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',6),i.value,'2026-11-01T00:02:03Z')->>'kind' from history_graph g cross join lifecycle_results i where g.name='main' and i.name='regen_identity'),'ready','successful same-ID replacement lookup replays its first result');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_ready(%L,%L,''regenerate'',%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',6),(select value from lifecycle_results where name='regen_identity'),'2026-11-01T00:02:03Z'),'same-ID successful replacement claim replays before rejecting its original version identity');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''REGENERATE_USED'')',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',60),(select value from lifecycle_results where name='regen_waiter_identity'),'2026-11-01T00:02:03Z'),'distinct waiter cannot borrow the winning replacement success through lookup');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''REGENERATE_USED'',true)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',60),(select value from lifecycle_results where name='regen_waiter_identity'),'2026-11-01T00:02:03Z'),'distinct waiter claim receives REGENERATE_USED after the one winning replacement');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''regenerate'',%L,%L::jsonb,null,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',32),(select value from lifecycle_results where name='regen_identity'),'2026-11-01T00:02:03Z'),'P0001','SCENARIO_CHANGED','new request ID cannot reuse the old version identity');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''regenerate'',%L,%L::jsonb,null,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',7),(select pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',7)) from history_graph where name='main'),'2026-11-01T00:02:04Z'),'P0001','REGENERATE_USED','different second replacement request is rejected after the one success');
select extensions.throws_ok(format('select public.mark_review_disclosure(%L,%L,''reveal'',%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),(select value from lifecycle_results where name='regen_identity'),'2026-11-01T00:02:04Z'),'P0001','SCENARIO_CHANGED','stale disclosure identity cannot mark a different published version');
select extensions.results_eq($$select to_jsonb(t),(select jsonb_agg(to_jsonb(o) order by o.request_id) from private.review_operations o where o.review_task_id=t.review_task_id),(select jsonb_agg(to_jsonb(h) order by h.scenario_version) from public.review_scenarios h where h.review_task_id=t.review_task_id) from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='main'$$,$$select task,operations,scenarios from lifecycle_success_before$$,'successful replay and rejected stale/second requests leave the published task, archives and cycle rows unchanged');

select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''prepare'',null,null,null,%L::timestamptz)','59200000-0000-4000-8000-000000000002',(select review_id from history_graph where name='main'),'2026-11-01T00:03:00Z'),'22023','owned review not found','foreign owner cannot claim another review');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)','59200000-0000-4000-8000-000000000002',(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',6),(select value->>'token' from lifecycle_results where name='regen'),pg_temp.lifecycle_generated('朋友问新的出租车费用合不合理。'),'2026-11-01T00:03:00Z'),'22023','owned review not found','foreign owner cannot publish with a stolen claim token');
select extensions.throws_ok(format('select public.mark_review_disclosure(%L,%L,''examples'',%L::jsonb,%L::timestamptz)','59200000-0000-4000-8000-000000000002',(select review_id from history_graph where name='main'),(select pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',8)) from history_graph where name='main'),'2026-11-01T00:03:00Z'),'22023','owned review not found','foreign owner cannot mark another review');
select extensions.is((select public.lookup_review_preparation('59200000-0000-4000-8000-000000000002',review_id,'prepare',pg_temp.history_id('592f0000',1),null,'2026-11-01T00:03:00Z') from history_graph where name='main'),null::jsonb,'foreign owner cannot recover another request outcome');
select extensions.ok(not (select public.fail_review_operation('59200000-0000-4000-8000-000000000002',g.review_id,pg_temp.history_id('592f0000',6),(o.value->>'token')::uuid,'PROVIDER_UNAVAILABLE','2026-11-01T00:03:00Z') from history_graph g cross join lifecycle_results o where g.name='main' and o.name='regen'),'foreign owner cannot alter another request outcome');
select extensions.results_eq(
 $$select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id),
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id),
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id),
 (select jsonb_agg(to_jsonb(r)-'expression_revealed_at'-'examples_opened_at' order by r.id) from public.review_tasks r join history_graph g on g.review_id=r.id)$$,
 $$select attempts,mastery,expressions,schedules from lifecycle_official_before$$,'preparation/replacement/markers do not change official attempts, mastery or scheduling');

-- Expired generations cannot publish or mark a known failure after losing lease.
insert into lifecycle_results select 'lease_old',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',10),null,null,'2026-11-01T01:00:00Z') from history_graph where name='same_word_candidate';
insert into lifecycle_results select 'lease_waiter',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',15),null,null,'2026-11-01T01:00:01Z') from history_graph where name='same_word_candidate';
select extensions.ok((select value->>'kind'='pending' and value->>'requestId'=pg_temp.history_id('592f0000',15)::text from lifecycle_results where name='lease_waiter'),'a lease waiter retains its own pending ID before expiry');
select extensions.ok(not (select public.fail_review_operation(owner_id,review_id,pg_temp.history_id('592f0000',10),pg_temp.history_id('592f0000',99),'PROVIDER_UNAVAILABLE','2026-11-01T01:01:00Z') from history_graph where name='same_word_candidate'),'wrong failure token cannot finish a live claim');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),pg_temp.history_id('592f0000',10),(select value->>'token' from lifecycle_results where name='lease_old'),pg_temp.lifecycle_generated('同事问新的订餐费是不是太贵。'),'2026-11-01T01:06:00Z'),'P0001','JOB_LEASE_CONFLICT','expired preparation cannot publish a scenario');
select extensions.ok(not (select public.fail_review_operation(g.owner_id,g.review_id,pg_temp.history_id('592f0000',10),(o.value->>'token')::uuid,'PROVIDER_UNAVAILABLE','2026-11-01T01:06:00Z') from history_graph g cross join lifecycle_results o where g.name='same_word_candidate' and o.name='lease_old'),'expired failure cannot falsely confirm an old cycle as failed');
select extensions.is((select public.lookup_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',10),null,'2026-11-01T01:06:00Z')->>'kind' from history_graph where name='same_word_candidate'),'failed','expired read-only lookup reports a failed old cycle');
select extensions.is((select public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',15),null,null,'2026-11-01T01:06:00Z') from history_graph where name='same_word_candidate'),jsonb_build_object('kind','failed','requestId',pg_temp.history_id('592f0000',15),'code','PROVIDER_UNAVAILABLE'),'expired winner waiter stays failed under its own ID instead of claiming a fresh cycle');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on g.review_id=o.review_task_id where g.name='same_word_candidate' and o.status='claimed' and o.lease_expires_at>'2026-11-01T01:06:00Z'),0,'expired waiter recovery creates no live generation claim');
insert into lifecycle_results select 'lease_new',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',11),null,null,'2026-11-01T01:06:00Z') from history_graph where name='same_word_candidate';
select extensions.is((select value->>'kind' from lifecycle_results where name='lease_new'),'claimed','fresh explicit request can replace an expired cycle');
select extensions.is((select count(*)::integer from private.review_operations o join history_graph g on g.review_id=o.review_task_id where g.name='same_word_candidate' and o.status='claimed'),1,'expired replacement leaves exactly one live cycle');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),pg_temp.history_id('592f0000',10),(select value->>'token' from lifecycle_results where name='lease_old'),pg_temp.lifecycle_generated('同事问新的机场服务费怎么样。'),'2026-11-01T01:06:01Z'),'P0001','JOB_LEASE_CONFLICT','stale token stays fenced after a new request wins');

-- A task appearing after an initial claim is a genuine stale-context boundary.
insert into public.practice_tasks
 select (jsonb_populate_record(null::public.practice_tasks,to_jsonb(t)||jsonb_build_object('id',pg_temp.history_id('592a0000',1),'user_id',g.owner_id,'user_expression_id',g.expression_id,'review_task_id',g.review_id,'due_at',(select due_at from public.review_tasks where id=g.review_id),'prompt_chinese','同事问新办公室的饮水费合不合理。','scenario_version',1,'regenerated',false))).*
 from public.practice_tasks t join history_graph m on m.review_id=t.review_task_id and m.name='main' cross join history_graph g where g.name='same_word_candidate';
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),pg_temp.history_id('592f0000',11),(select value->>'token' from lifecycle_results where name='lease_new'),pg_temp.lifecycle_generated('同事问新办公室的清洁费合不合理。'),'2026-11-01T01:06:02Z'),'P0001','SCENARIO_CHANGED','a claim cannot overwrite a task published after its expected version snapshot');
select extensions.ok((select public.fail_review_operation(g.owner_id,g.review_id,pg_temp.history_id('592f0000',11),(o.value->>'token')::uuid,'SCENARIO_CHANGED','2026-11-01T01:06:03Z') from history_graph g cross join lifecycle_results o where g.name='same_word_candidate' and o.name='lease_new'),'stale-context request can finish without altering the newer task');
select extensions.ok((select public.mark_review_disclosure(owner_id,review_id,'examples',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',12)),'2026-11-01T01:06:04Z') from history_graph where name='same_word_candidate'),'examples can be the first disclosure operation');
select extensions.ok((select r.expression_revealed_at='2026-11-01T01:06:04Z' and r.examples_opened_at='2026-11-01T01:06:04Z' from public.review_tasks r join history_graph g on g.review_id=r.id where g.name='same_word_candidate'),'first examples disclosure atomically persists both reveal and assistance markers');

-- Existing supported job rows exercise only the 033 owner/attempt/lease fence.
-- The separate prepare_transfer_task outbox/job-kind integration is A's own gate.
insert into public.knowledge_jobs(id,user_id,video_source_id,saved_item_id,job_type,status,dedupe_key,attempt_count,lease_expires_at)
 select pg_temp.history_id('592e0000',case when name='other_owner' then 1 else 2 end),owner_id,source_id,save_id,'analyze_saved_item','leased',repeat(md5(review_id::text),2),1,'2026-11-01T02:05:00Z' from history_graph where name in('main','other_owner');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''prepare'',%L,null,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='other_owner'),pg_temp.history_id('592f0000',20),jsonb_build_object('jobId',pg_temp.history_id('592e0000',2),'attemptCount',1,'leaseExpiresAt','2026-11-01T02:05:00Z'),'2026-11-01T02:00:00Z'),'P0001','JOB_LEASE_CONFLICT','worker cannot claim through another owner job');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''prepare'',%L,null,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='other_owner'),pg_temp.history_id('592f0000',20),jsonb_build_object('jobId',pg_temp.history_id('592e0000',1),'attemptCount',2,'leaseExpiresAt','2026-11-01T02:05:00Z'),'2026-11-01T02:00:00Z'),'P0001','JOB_LEASE_CONFLICT','worker must present the current attempt count');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''prepare'',%L,null,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='other_owner'),pg_temp.history_id('592f0000',20),jsonb_build_object('jobId',pg_temp.history_id('592e0000',1),'attemptCount',1,'leaseExpiresAt','2026-11-01T02:04:00Z'),'2026-11-01T02:00:00Z'),'P0001','JOB_LEASE_CONFLICT','worker lease expiry must exactly match its stored fence');
insert into public.knowledge_jobs(id,user_id,video_source_id,saved_item_id,job_type,status,dedupe_key,attempt_count,lease_expires_at)
 select pg_temp.history_id('592e0000',3),owner_id,source_id,save_id,'analyze_saved_item','leased',repeat('f',64),1,'2026-11-01T01:00:00Z' from history_graph where name='other_owner';
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''prepare'',%L,null,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='other_owner'),pg_temp.history_id('592f0000',20),jsonb_build_object('jobId',pg_temp.history_id('592e0000',3),'attemptCount',1,'leaseExpiresAt','2026-11-01T01:00:00Z'),'2026-11-01T02:00:00Z'),'P0001','JOB_LEASE_CONFLICT','expired worker job cannot acquire an initial preparation claim');
insert into lifecycle_results select 'job_old',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',20),null,jsonb_build_object('jobId',pg_temp.history_id('592e0000',1),'attemptCount',1,'leaseExpiresAt','2026-11-01T02:05:00Z'),'2026-11-01T02:00:00Z') from history_graph where name='other_owner';
update public.knowledge_jobs set attempt_count=2 where id=pg_temp.history_id('592e0000',1);
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='other_owner'),pg_temp.history_id('592f0000',20),(select value->>'token' from lifecycle_results where name='job_old'),pg_temp.lifecycle_generated('同事问新快递的费用怎么样。'),'2026-11-01T02:00:01Z'),'P0001','JOB_LEASE_CONFLICT','publication rechecks job fencing after the model work');
select extensions.is((select count(*)::integer from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='other_owner'),0,'lost worker cannot leave a partially published task');
select extensions.ok((select public.fail_review_operation(g.owner_id,g.review_id,pg_temp.history_id('592f0000',20),(o.value->>'token')::uuid,'PROVIDER_UNAVAILABLE','2026-11-01T02:00:02Z') from history_graph g cross join lifecycle_results o where g.name='other_owner' and o.name='job_old'),'lost worker cycle can be marked failed without a task');
insert into lifecycle_results select 'job_new',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('592f0000',21),null,jsonb_build_object('jobId',pg_temp.history_id('592e0000',1),'attemptCount',2,'leaseExpiresAt','2026-11-01T02:05:00Z'),'2026-11-01T02:00:03Z') from history_graph where name='other_owner';
insert into lifecycle_results select 'job_publish',public.publish_review_scenario(g.owner_id,g.review_id,pg_temp.history_id('592f0000',21),(o.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问新快递的费用怎么样。'),'2026-11-01T02:00:04Z') from history_graph g cross join lifecycle_results o where g.name='other_owner' and o.name='job_new';
select extensions.is((select count(*)::integer from public.practice_tasks t join history_graph g on g.review_id=t.review_task_id where g.name='other_owner'),1,'current worker fence publishes one owner-scoped task');

-- A real official completion racing an existing replacement claim wins.
insert into lifecycle_results select 'answer_race_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',30)) from history_graph where name='same_word_candidate';
insert into lifecycle_results select 'answer_race_claim',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('592f0000',30),i.value,null,'2026-11-01T03:00:00Z') from history_graph g cross join lifecycle_results i where g.name='same_word_candidate' and i.name='answer_race_identity';
create temp table lifecycle_completed as
 select g.name,public.complete_due_practice_with_examples(g.owner_id,jsonb_build_object('reviewTaskId',g.review_id,'practiceTaskId',t.id,'responseChinese','这里高得要命。','accuracyScore',4,'accuracyFeedbackEnglish','Accurate.','naturalnessScore',4,'naturalnessFeedbackEnglish','Natural.','contextualFitScore',4,'contextualFitFeedbackEnglish','Fits.','completedAt','2026-11-01T03:00:01Z')) result
 from history_graph g join public.practice_tasks t on t.review_task_id=g.review_id where g.name in('main','same_word_candidate');
select extensions.is((select count(*)::integer from lifecycle_completed),2,'completion race fixtures use actual immutable due-completion receipts');
select extensions.throws_ok(format('select public.publish_review_scenario(%L,%L,%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),pg_temp.history_id('592f0000',30),(select value->>'token' from lifecycle_results where name='answer_race_claim'),pg_temp.lifecycle_generated('同事问新课程的报名费怎么样。'),'2026-11-01T03:00:02Z'),'P0001','ALREADY_SUBMITTED','an answered review rejects publication from an earlier replacement claim');
select extensions.throws_ok(format('select public.claim_review_preparation(%L,%L,''regenerate'',%L,%L::jsonb,null,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',31),(select pg_temp.lifecycle_identity(review_id,pg_temp.history_id('592f0000',31)) from history_graph where name='main'),'2026-11-01T03:00:02Z'),'P0001','ALREADY_SUBMITTED','a fresh replacement request cannot change an answered review');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_ready(%L,%L,''regenerate'',%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',6),(select value from lifecycle_results where name='regen_identity'),'2026-11-01T03:00:03Z'),'successful same-ID replacement safely recovers the current official state after completion');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''ALREADY_SUBMITTED'')',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',60),(select value from lifecycle_results where name='regen_waiter_identity'),'2026-11-01T03:00:03Z'),'completed review rejects a different waiting replacement through lookup');
select extensions.lives_ok(format('select pg_temp.lifecycle_require_conflict(%L,%L,%L,%L::jsonb,%L::timestamptz,''ALREADY_SUBMITTED'',true)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.history_id('592f0000',60),(select value from lifecycle_results where name='regen_waiter_identity'),'2026-11-01T03:00:03Z'),'completed review rejects a different waiting replacement through claim');
select extensions.is((select h.context_fingerprint from public.review_scenarios h join history_graph g on g.review_id=h.review_task_id where g.name='main' and h.scenario_version=1),(select task->>'context_fingerprint' from lifecycle_failed_before),'archived original task keeps its original mastery-context hash');

-- Five public lifecycle RPCs remain service-only; tables are not browser writes.
select extensions.ok(bool_and(has_function_privilege('service_role',signature,'execute') and not has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute')),'all five lifecycle entry points are service-only') from unnest(array[
 'public.lookup_review_preparation(uuid,uuid,text,uuid,jsonb,timestamptz)',
 'public.claim_review_preparation(uuid,uuid,text,uuid,jsonb,jsonb,timestamptz)',
 'public.publish_review_scenario(uuid,uuid,uuid,uuid,jsonb,timestamptz)',
 'public.fail_review_operation(uuid,uuid,uuid,uuid,text,timestamptz)',
 'public.mark_review_disclosure(uuid,uuid,text,jsonb,timestamptz)']) signature;
set local role authenticated;
select set_config('request.jwt.claim.sub','59200000-0000-4000-8000-000000000001',true);
select extensions.throws_ok($$select public.claim_review_preparation('59200000-0000-4000-8000-000000000001','592f0000-0000-4000-8000-000000000001','prepare',null,null,null,'2026-11-01T04:00:00Z')$$,'42501',null,'browser cannot call service preparation even for its own UUID');
select extensions.throws_ok($$select * from private.review_operations$$,'42501',null,'browser cannot read claim tokens or private request receipts');
reset role;
set local role anon;
select extensions.throws_ok($$select public.mark_review_disclosure('59200000-0000-4000-8000-000000000001','592f0000-0000-4000-8000-000000000001','examples','{}','2026-11-01T04:00:00Z')$$,'42501',null,'anonymous cannot forge a disclosure marker');
reset role;

select * from extensions.finish();
rollback;
