begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59100000-0000-4000-8000-000000000001','59100000-0000-4000-8000-000000000002')),0,'previous history test transactions leave neither fixture owner behind');

-- B3 isolated rollback fixtures. All UUID families are 591*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59100000-0000-4000-8000-000000000001','review-history-a@popcorn.test','authenticated','authenticated'),
 ('59100000-0000-4000-8000-000000000002','review-history-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59100000-0000-4000-8000-000000000001'),('59100000-0000-4000-8000-000000000002') on conflict do nothing;

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
  owner:=case when n=3 then '59100000-0000-4000-8000-000000000002'::uuid else '59100000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59110000',n);snapshot:=pg_temp.history_id('59120000',n);save:=pg_temp.history_id('59130000',n);artifact:=pg_temp.history_id('59140000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59190000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
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
   draft:=pg_temp.history_id('59150000',n*10+r);future:=pg_temp.history_id('59160000',n*10+r);answer:=pg_temp.history_id('59170000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59150000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
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
select extensions.is((select count(*)::integer from public.practice_draft_attempts a join public.practice_drafts d on d.id=a.practice_draft_id where d.user_id='59100000-0000-4000-8000-000000000001' and a.naturalness_score=2),1,'history contains a genuinely failed first-round answer');

-- Same stable candidate gets a newer readable artifact, but a different meaning
-- must not overwrite a valid canonical card or be found by same-word guessing.
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
 select pg_temp.history_id('59140000',11),owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',
 jsonb_build_object('candidates',jsonb_build_array(card||'{"meaningHere":"Exact linked recovery card."}'::jsonb,card||'{"highlightKey":"different-same-word-mark","meaningHere":"Wrong same-word card."}'::jsonb)),
 'analyze-saved-item-v3','fixture/history',repeat('c',64),'2026-10-02T00:00:00Z' from history_graph where name='main';

-- Existing current pending review is from promotion. Add an earlier cancelled
-- review and one due task for each; no completion receipt is fabricated.
insert into public.review_tasks(id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes,created_at,updated_at)
 select pg_temp.history_id('59180000',1),owner_id,expression_id,'tried','cancelled','2026-09-30T00:00:00Z',1,0,'2026-09-29T00:00:00Z','2026-09-30T00:00:00Z' from history_graph where name='main';
insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,review_task_id,created_at,transfer_type,scenario_metadata_mode,scenario_source,scenario_fingerprint,situation_en,interlocutor,task_en,target_function,target_setting)
 select pg_temp.history_id('591a0000',1),owner_id,expression_id,'due_practice','en','zh-CN','高得要命','邻居问旧电费为什么涨了。','Complain naturally.','Use the expression.','2026-09-30T00:00:00Z'::timestamptz,pg_temp.history_id('59180000',1),'2026-09-29T00:00:00Z'::timestamptz,'far','modern','model',private.practice_situation_fingerprint('邻居问旧电费为什么涨了。'),'A neighbor asks why the electricity charge increased.','邻居','Complain about the price.','complain','casual_chat' from history_graph where name='main'
 union all
 select pg_temp.history_id('591a0000',2),owner_id,expression_id,'due_practice','en','zh-CN','高得要命','群友问新健身房会费值不值得。','Complain naturally.','Use the expression.','2026-10-02T04:00:00Z'::timestamptz,review_id,'2026-10-02T00:00:00Z'::timestamptz,'near','modern','model',private.practice_situation_fingerprint('群友问新健身房会费值不值得。'),'A group member asks whether the new gym fee is worth it.','群友','Complain about the price.','complain','online_social' from history_graph where name='main';
create temp table history_hash_before as select id,context_fingerprint from public.practice_tasks where user_id in('59100000-0000-4000-8000-000000000001','59100000-0000-4000-8000-000000000002');
insert into public.review_scenarios(id,user_id,review_task_id,practice_task_id,user_expression_id,scenario_version,scenario_fingerprint,context_fingerprint,prompt_chinese,snapshot,created_at)
 select pg_temp.history_id('591b0000',n),g.owner_id,t.review_task_id,t.id,g.expression_id,1,private.practice_situation_fingerprint(prompt),private.compute_practice_context_fingerprint(t.target_expression,prompt,t.instructions_english,t.goal_english),prompt,to_jsonb(t)||jsonb_build_object('prompt_chinese',prompt,'scenario_version',1,'context_fingerprint',private.compute_practice_context_fingerprint(t.target_expression,prompt,t.instructions_english,t.goal_english)),'2026-10-01T12:00:00Z'::timestamptz+n*interval '1 minute'
 from history_graph g cross join (values(1,'老板问旧出差费有没有超标。'),(2,'同学问旧教材价格合不合理。')) replaced(n,prompt)
 join public.practice_tasks t on t.id=pg_temp.history_id('591a0000',n) where g.name='main';
update public.practice_tasks set scenario_version=2,regenerated=true,scenario_fingerprint=private.practice_situation_fingerprint(prompt_chinese) where id in(pg_temp.history_id('591a0000',1),pg_temp.history_id('591a0000',2));

create temp table read_history_context as select name,public.read_review_practice_context(owner_id,review_id) as value from history_graph;
select extensions.results_eq(
 $$select value from jsonb_array_elements_text((select value->'history' from read_history_context where name='main')) order by value$$,
 $$values('朋友问旧咖啡价格合不合理。'),('店员问旧雨伞价格是否能接受。'),('同事问旧停车费是不是太贵。'),('家人问新水杯的价格怎么样。'),('邻居问旧电费为什么涨了。'),('群友问新健身房会费值不值得。'),('老板问旧出差费有没有超标。'),('同学问旧教材价格合不合理。') order by 1$$,
 'full exact history includes failed/removed/superseded rounds, canonical first, all due tasks and replaced snapshots');
select extensions.is(jsonb_array_length((select value->'history' from read_history_context where name='main')),8,'canonical winning draft/task duplication is returned once without truncating history');
select extensions.ok(not exists(select 1 from jsonb_array_elements_text((select value->'history' from read_history_context where name='main')) s where s.value in('另一候选的朋友问学费贵不贵。','另一用户的同事问房租怎么样。')),'same expression text never mixes another candidate or owner history');
select extensions.is((select value->>'lastTransferType' from read_history_context where name='main'),'far','actual prior due direction excludes the current review');
select extensions.is((select value#>>'{canonicalCard,meaningHere}' from read_history_context where name='main'),'Canonical price complaint.','valid canonical modern meaning is preserved separately from a newer linked card');
select extensions.is((select value#>>'{linkedCard,meaningHere}' from read_history_context where name='main'),'Exact linked recovery card.','linked recovery follows the winning receipt stable candidate across artifact versions');
select extensions.is((select value#>>'{linkedCard,meaningHere}' from read_history_context where name='same_word_candidate'),'Different candidate meaning.','same-word other candidate keeps its own exact linked card');
select extensions.is((select value#>>'{linkedCard,meaningHere}' from read_history_context where name='other_owner'),'Other owner meaning.','same-word other owner keeps its own exact linked card');

-- A legacy canonical row may recover only from the exact linked modern card.
update public.expression_senses set meaning_here=null,use_it_when=null,compared_with=null,how_it_fits=null,tone_and_who=null,function_categories='{}',usage_settings='{}' where id=(select sense_id from history_graph where name='main');
select extensions.is(public.read_review_practice_context((select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'))#>'{canonicalCard,meaningHere}','null'::jsonb,'legacy canonical data stays explicitly incomplete instead of receiving an invented default');
select extensions.is(public.read_review_practice_context((select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'))#>>'{linkedCard,meaningHere}','Exact linked recovery card.','incomplete canonical data still exposes only exact owned linked recovery');
update public.generated_artifacts set content=jsonb_set(content,'{candidates,0,meaningHere}','""') where id in((select artifact_id from history_graph where name='main'),pg_temp.history_id('59140000',11));
select extensions.is(public.read_review_practice_context((select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'))->'linkedCard','null'::jsonb,'missing readable exact card never falls back to another same-word candidate');

select extensions.is(public.read_review_practice_context('59100000-0000-4000-8000-000000000002',(select review_id from history_graph where name='main')),null::jsonb,'service owner argument cannot join a foreign review graph');
select extensions.results_eq($$select t.id,t.context_fingerprint from public.practice_tasks t join history_hash_before b using(id) order by t.id$$,$$select id,context_fingerprint from history_hash_before order by id$$,'reads, recovery and scenario-only metadata do not rewrite historical mastery hashes');
select extensions.is((select t.context_fingerprint from public.practice_tasks t join history_graph g on g.draft_id=t.id where g.name='main'),'4df299a81b0c4c953d84d5f0cd9c9342fb4428e6d08b473854151d77d6457eef','canonical first mastery hash keeps its independently calculated original length-prefixed value');

-- Complete real due tasks through the accepted official RPC before creating
-- learning-only revision rows. A pending review cannot stand in for this graph.
insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,review_task_id,created_at,transfer_type,scenario_metadata_mode,scenario_source,scenario_fingerprint,situation_en,interlocutor,task_en,target_function,target_setting)
 select pg_temp.history_id('591a0000',case when name='same_word_candidate' then 3 else 4 end),owner_id,expression_id,'due_practice','en','zh-CN','高得要命',case when name='same_word_candidate' then '另一候选的店员问新衣服价格合不合理。' else '另一用户的家人问新汽车价格怎么样。' end,
 'Complain naturally.','Use the expression.','2026-10-02T04:00:00Z',review_id,'2026-10-02T00:00:00Z','near','modern','model',private.practice_situation_fingerprint(case when name='same_word_candidate' then '另一候选的店员问新衣服价格合不合理。' else '另一用户的家人问新汽车价格怎么样。' end),'You are asked whether a new purchase is too expensive.','朋友','Complain about the price.','complain','casual_chat' from history_graph where name<>'main';
create temp table history_completed as
 select g.name,c.* from history_graph g join public.practice_tasks t on t.review_task_id=g.review_id
 cross join lateral public.complete_due_practice(g.owner_id,g.review_id,t.id,repeat(md5(g.review_id::text),2),'这里高得要命。','none',true,4,'Accurate.',4,'Natural.',4,'Fits.','2026-11-01T00:00:00Z',null,null,null,null,null) c;
select extensions.is((select count(*)::integer from history_completed),3,'all revision fixtures have real official due-completion receipts');
create temp table history_official_before as select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id) attempts,
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id) mastery,
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.review_tasks r join history_graph g on g.owner_id=r.user_id and g.expression_id=r.user_expression_id) reviews,
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id) expressions,
 (select jsonb_agg(to_jsonb(r) order by r.review_task_id) from private.due_practice_completion_receipts r join history_graph g on g.review_id=r.review_task_id) receipts;
insert into public.review_revisions(id,user_id,request_id,review_task_id,attempt_id,practice_task_id,user_expression_id,scenario_version,scenario_fingerprint,response_chinese,evaluation,coaching,evaluation_prompt_version,evaluation_model)
 select pg_temp.history_id('591c0000',row_number() over(order by g.name)::integer),g.owner_id,pg_temp.history_id('591d0000',row_number() over(order by g.name)::integer),g.review_id,c.attempt_id,c.practice_task_id,g.expression_id,t.scenario_version,t.scenario_fingerprint,'这里高得要命。',
 '{"accuracy":{"score":4,"englishFeedback":"Accurate."},"naturalness":{"score":4,"englishFeedback":"Natural."},"contextualFit":{"score":4,"englishFeedback":"Fits."},"passed":true,"independentUse":true,"assistanceLevel":"none"}',null,'evaluate-practice-v5','fixture/history'
 from history_graph g join history_completed c on c.name=g.name join public.practice_tasks t on t.id=c.practice_task_id;
select extensions.is(public.read_review_practice_context((select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'))#>>'{officialAttempt,id}',(select attempt_id::text from history_completed where name='main'),'read context recovers the actual completed official due attempt');
select extensions.is(public.read_review_practice_context((select owner_id from history_graph where name='main'),(select review_id from history_graph where name='main'))#>>'{latestRevision,attempt_id}',(select attempt_id::text from history_completed where name='main'),'latest revision remains attached to that official attempt');
select extensions.results_eq(
 $$select
 (select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a join history_graph g on g.owner_id=a.user_id and g.expression_id=a.user_expression_id),
 (select jsonb_agg(to_jsonb(m) order by m.id) from public.mastery_events m join history_graph g on g.owner_id=m.user_id and g.expression_id=m.user_expression_id),
 (select jsonb_agg(to_jsonb(r) order by r.id) from public.review_tasks r join history_graph g on g.owner_id=r.user_id and g.expression_id=r.user_expression_id),
 (select jsonb_agg(to_jsonb(u) order by u.id) from public.user_expressions u join history_graph g on g.expression_id=u.id),
 (select jsonb_agg(to_jsonb(r) order by r.review_task_id) from private.due_practice_completion_receipts r join history_graph g on g.review_id=r.review_task_id)$$,
 $$select attempts,mastery,reviews,expressions,receipts from history_official_before$$,'revision storage and context reads do not change official evidence, mastery, schedules or completion receipts');
select extensions.ok(has_function_privilege('service_role','public.read_review_practice_context(uuid,uuid)','execute'),'service alone may choose an owned context graph');
select extensions.ok(not has_function_privilege('authenticated','public.read_review_practice_context(uuid,uuid)','execute') and not has_function_privilege('anon','public.read_review_practice_context(uuid,uuid)','execute'),'browser roles cannot select arbitrary context owners');
select extensions.ok(not has_table_privilege('authenticated','private.review_operations','select') and not has_table_privilege('service_role','private.review_operations','select'),'operation receipts have no direct browser or service table access');
select extensions.ok(not has_function_privilege('service_role','private.today_candidate_cards(uuid)','execute') and not has_function_privilege('authenticated','private.today_candidate_cards(uuid)','execute'),'private candidate projection remains behind service-only public context RPC');

select owner_id,review_id from history_graph where name='main' \gset history_
set local role service_role;
select extensions.is(public.read_review_practice_context(:'history_owner_id',:'history_review_id')#>>'{review,user_id}',:'history_owner_id','actual service role reads its selected owned context through security definer');
select extensions.throws_ok($$select * from private.review_operations$$,'42501',null,'actual service role cannot read private request receipts directly');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','59100000-0000-4000-8000-000000000001',true);
select extensions.is((select count(*)::integer from public.review_revisions),2,'RLS exposes only owner A revision rows');
select extensions.is((select count(*)::integer from public.review_scenarios),2,'RLS exposes owner A replaced scenario history');
select extensions.throws_ok($$insert into public.review_revisions(id) values('591c0000-0000-4000-8000-000000000099')$$,'42501',null,'authenticated cannot write revision rows directly');
select extensions.throws_ok($$update public.review_revisions set response_chinese='伪造修订。'$$,'42501',null,'authenticated cannot alter scored revisions');
select extensions.throws_ok($$delete from public.review_revisions$$,'42501',null,'authenticated cannot remove scored revisions');
select extensions.throws_ok($$insert into public.review_scenarios(id) values('591b0000-0000-4000-8000-000000000099')$$,'42501',null,'authenticated cannot invent replaced scenario history');
select extensions.throws_ok($$select public.read_review_practice_context('59100000-0000-4000-8000-000000000001','59180000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated cannot invoke owner-selected context RPC');
select extensions.throws_ok($$select * from private.review_operations$$,'42501',null,'authenticated cannot inspect private request receipts');
select set_config('request.jwt.claim.sub','59100000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.review_revisions),1,'RLS exposes only owner B revision rows');
select extensions.is((select count(*)::integer from public.review_scenarios),0,'RLS hides all owner A replaced scenarios from owner B');
reset role;

select * from extensions.finish();
rollback;
