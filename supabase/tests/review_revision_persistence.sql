begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000002')),0,'previous lifecycle test transactions leave neither fixture owner behind');

-- B4 lifecycle rollback fixtures. All UUID families are 594*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59400000-0000-4000-8000-000000000001','review-persistence-a@popcorn.test','authenticated','authenticated'),
 ('59400000-0000-4000-8000-000000000002','review-persistence-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59400000-0000-4000-8000-000000000001'),('59400000-0000-4000-8000-000000000002') on conflict do nothing;

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
  owner:=case when n=3 then '59400000-0000-4000-8000-000000000002'::uuid else '59400000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59410000',n);snapshot:=pg_temp.history_id('59420000',n);save:=pg_temp.history_id('59430000',n);artifact:=pg_temp.history_id('59440000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59490000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
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
   draft:=pg_temp.history_id('59450000',n*10+r);future:=pg_temp.history_id('59460000',n*10+r);answer:=pg_temp.history_id('59470000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59450000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
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
 'transferType',direction,'promptVersion','transfer-scenario-v1','model','fixture/review-persistence','pin',null)
$$;
create function pg_temp.lifecycle_identity(review uuid,request uuid) returns jsonb language sql as $$
 select jsonb_build_object('taskId',id,'scenarioVersion',scenario_version,'scenarioFingerprint',scenario_fingerprint,'requestId',request) from public.practice_tasks where review_task_id=review
$$;


create temp table revision_results(name text primary key,value jsonb);
create function pg_temp.official_input(identity jsonb) returns jsonb language sql as $$
 select jsonb_build_object('reviewTaskId',g.review_id,'practiceTaskId',identity->>'taskId','scenarioVersion',identity->'scenarioVersion','scenarioFingerprint',identity->>'scenarioFingerprint',
 'responseChinese','这个价格高得要命。','accuracyScore',4,'accuracyFeedbackEnglish','Accurate.','naturalnessScore',4,'naturalnessFeedbackEnglish','Natural.','contextualFitScore',4,'contextualFitFeedbackEnglish','Fits.',
 'completedAt','2026-11-01T00:10:00Z','evaluationPromptVersion',null,'evaluationModel',null,'evaluationGatewayConfigId',null,'evaluationGatewayRevision',null,'evaluationGatewayFingerprint',null,
 'coaching',jsonb_build_object('naturalRevisionChinese','这个价格真的高得要命。'))
 from history_graph g where g.name='main'
$$;
insert into revision_results select 'claim1',public.claim_review_preparation(owner_id,review_id,'prepare',pg_temp.history_id('594f0000',1),null,null,'2026-11-01T00:00:00Z') from history_graph where name='main';
insert into revision_results select 'published1',public.publish_review_scenario(g.owner_id,g.review_id,(c.value->>'requestId')::uuid,(c.value->>'token')::uuid,pg_temp.lifecycle_generated('同事问一份午餐两百元你怎么看。'),'2026-11-01T00:00:01Z') from history_graph g cross join revision_results c where g.name='main' and c.name='claim1';
insert into revision_results select 'old_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('594f0000',2)) from history_graph where name='main';
insert into revision_results select 'claim2',public.claim_review_preparation(g.owner_id,g.review_id,'regenerate',pg_temp.history_id('594f0000',2),i.value,null,'2026-11-01T00:00:02Z') from history_graph g cross join revision_results i where g.name='main' and i.name='old_identity';
insert into revision_results select 'published2',public.publish_review_scenario(g.owner_id,g.review_id,(c.value->>'requestId')::uuid,(c.value->>'token')::uuid,pg_temp.lifecycle_generated('同事说打印一张表收费五十元，问你怎么看。'),'2026-11-01T00:00:03Z') from history_graph g cross join revision_results c where g.name='main' and c.name='claim2';
select extensions.throws_ok(format('select public.complete_due_review_with_snapshot(%L,%L::jsonb)',(select owner_id from history_graph where name='main'),pg_temp.official_input((select value from revision_results where name='old_identity'))),'P0001','SCENARIO_CHANGED','old question scores cannot complete a question regenerated during model evaluation');
select extensions.is((select count(*)::integer from public.attempts a join history_graph g on g.expression_id=a.user_expression_id where g.name='main'),1,'rejected stale completion writes no official attempt');
insert into revision_results select 'current_identity',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('594f0000',3)) from history_graph where name='main';
insert into revision_results select 'official',public.complete_due_review_with_snapshot(g.owner_id,pg_temp.official_input(i.value)) from history_graph g cross join revision_results i where g.name='main' and i.name='current_identity';
select extensions.ok((select (value->'completion'->>'created')::boolean from revision_results where name='official'),'current snapshot completes through the existing atomic scheduling RPC');
select extensions.is((select a.review_scenario_version from public.attempts a join public.review_tasks r on r.completed_attempt_id=a.id join history_graph g on g.review_id=r.id where g.name='main'),2,'official evidence is bound to scored scenario version two');
select extensions.is((select a.coaching->>'naturalRevisionChinese' from public.attempts a join public.review_tasks r on r.completed_attempt_id=a.id join history_graph g on g.review_id=r.id where g.name='main'),'这个价格真的高得要命。','official coaching persists in the same completion transaction');

create function pg_temp.revision_input(request_number integer,response text default '这个收费高得要命。') returns jsonb language sql as $$
 select pg_temp.lifecycle_identity(g.review_id,pg_temp.history_id('594e0000',request_number))||jsonb_build_object('attemptId',r.completed_attempt_id,'responseChinese',response)
 from history_graph g join public.review_tasks r on r.id=g.review_id where g.name='main'
$$;
create function pg_temp.revision_evaluation(score integer default 4) returns jsonb language sql as $$
 select jsonb_build_object('evaluation',jsonb_build_object('passed',true,'independentUse',true,'assistanceLevel','none','accuracy',jsonb_build_object('score',score,'englishFeedback','Accurate.'),'naturalness',jsonb_build_object('score',score,'englishFeedback','Natural.'),'contextualFit',jsonb_build_object('score',score,'englishFeedback','Fits.')),'coaching',jsonb_build_object('naturalRevisionChinese','这个价格高得要命。'),'promptVersion','evaluate-practice-v5','model','fixture/review-revision','pin',null)
$$;
insert into revision_results select 'revision_claim',public.claim_review_revision(owner_id,review_id,pg_temp.revision_input(1),'2026-11-01T00:11:00Z') from history_graph where name='main';
select extensions.is((select value->>'kind' from revision_results where name='revision_claim'),'claimed','learning revision claims its official answer and request signature');
select extensions.is((select public.lookup_review_revision(owner_id,review_id,pg_temp.revision_input(1),'2026-11-01T00:11:01Z')->>'kind' from history_graph where name='main'),'pending','same revision UUID in flight never authorizes a new scoring cycle');
select extensions.ok((select public.mark_review_disclosure(owner_id,review_id,'examples',pg_temp.lifecycle_identity(review_id,pg_temp.history_id('594f0000',4)),'2026-11-01T00:11:02Z') from history_graph where name='main'),'another tab may open examples while revision scoring is in flight');
create temp table revision_official_before as select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id) attempts,
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id) mastery,
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id) expressions,
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.review_tasks r join history_graph g on g.owner_id=r.user_id and g.expression_id=r.user_expression_id) schedules,
 (select jsonb_agg(to_jsonb(receipt) order by receipt.review_task_id) from private.due_practice_completion_receipts receipt join history_graph g on g.expression_id=receipt.user_expression_id) receipts;
insert into revision_results select 'revision',public.publish_review_revision(g.owner_id,g.review_id,pg_temp.revision_input(1),(c.value->>'token')::uuid,pg_temp.revision_evaluation(),'2026-11-01T00:11:03Z') from history_graph g cross join revision_results c where g.name='main' and c.name='revision_claim';
select extensions.is((select value->'evaluation'->>'assistanceLevel' from revision_results where name='revision'),'model_answer','revision publication uses the current locked server examples marker');
select extensions.ok(not (select (value->'evaluation'->>'independentUse')::boolean from revision_results where name='revision'),'stale pre-model independent flag cannot defeat examples opened during scoring');
select extensions.is((select public.lookup_review_revision(owner_id,review_id,pg_temp.revision_input(1),'2026-11-01T00:11:04Z')->>'kind' from history_graph where name='main'),'ready','successful revision request is replayable');
select extensions.is((select public.publish_review_revision(g.owner_id,g.review_id,pg_temp.revision_input(1),(c.value->>'token')::uuid,pg_temp.revision_evaluation(5),'2026-11-01T00:11:05Z')->>'id' from history_graph g cross join revision_results c where g.name='main' and c.name='revision_claim'),(select value->>'id' from revision_results where name='revision'),'same signature replays the original stored revision rather than rescoring or overwriting it');
select extensions.is((select count(*)::integer from public.review_revisions where user_id='59400000-0000-4000-8000-000000000001'),1,'duplicate publication creates no second learning revision');
select extensions.throws_ok(format('select public.lookup_review_revision(%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'),pg_temp.revision_input(1,'这个价格高得要命。'),'2026-11-01T00:11:06Z'),'P0001','IDEMPOTENCY_CONFLICT','same revision UUID cannot silently change the submitted text');
insert into revision_results select 'all5_claim',public.claim_review_revision(owner_id,review_id,pg_temp.revision_input(2),'2026-11-01T00:12:00Z') from history_graph where name='main';
insert into revision_results select 'all5',public.publish_review_revision(g.owner_id,g.review_id,pg_temp.revision_input(2),(c.value->>'token')::uuid,pg_temp.revision_evaluation(5),'2026-11-01T00:12:01Z') from history_graph g cross join revision_results c where g.name='main' and c.name='all5_claim';
select extensions.is((select value->'coaching' from revision_results where name='all5'),'null'::jsonb,'all-five learning revisions suppress natural-version coaching');
select extensions.results_eq($$select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id),
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id),
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id),
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.review_tasks r join history_graph g on g.owner_id=r.user_id and g.expression_id=r.user_expression_id),
 (select jsonb_agg(to_jsonb(receipt) order by receipt.review_task_id) from private.due_practice_completion_receipts receipt join history_graph g on g.expression_id=receipt.user_expression_id)$$,$$select * from revision_official_before$$,'all revision writes leave the complete official attempt/mastery/expression/schedule/receipt rows unchanged');
insert into revision_results select 'official_replay',public.complete_due_review_with_snapshot(g.owner_id,pg_temp.official_input(i.value)||jsonb_build_object('coaching',null)) from history_graph g cross join revision_results i where g.name='main' and i.name='current_identity';
select extensions.is((select value->>'assistanceLevel' from revision_results where name='official_replay'),'none','later examples do not rewrite the official independent receipt on replay');
select extensions.is((select a.coaching->>'naturalRevisionChinese' from public.attempts a join public.review_tasks r on r.completed_attempt_id=a.id join history_graph g on g.review_id=r.id where g.name='main'),'这个价格真的高得要命。','replay cannot replace original official coaching with later request data');
select extensions.throws_ok(format('select public.claim_review_revision(%L,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select review_id from history_graph where name='main'),pg_temp.revision_input(3),'2026-11-01T00:13:00Z'),'22023','owned review not found','cross-owner official revision claim is rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub','59400000-0000-4000-8000-000000000001',true);
select extensions.is((select count(*)::integer from public.review_revisions),2,'RLS exposes only this owners two learning revisions');
select set_config('request.jwt.claim.sub','59400000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.review_revisions),0,'RLS hides another owners learning revision answers');
select extensions.throws_ok($$select public.claim_review_revision('59400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000002','{}',now())$$,'42501',null,'authenticated clients cannot publish their own evaluation');
reset role;
select * from extensions.finish();
rollback;
