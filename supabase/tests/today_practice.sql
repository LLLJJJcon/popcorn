begin;
select extensions.no_plan();
select extensions.has_function('public','get_today_practice_summary',array['uuid','timestamp with time zone'],'today has exact aggregate summary');
select extensions.has_function('public','list_today_practice_items',array['uuid','timestamp with time zone','integer','integer'],'today items are paged');
select extensions.has_function('public','get_today_practice_next',array['uuid','timestamp with time zone','uuid[]','uuid','uuid'],'next recomputes with excludes and verified resume');
select extensions.ok(not has_function_privilege('authenticated','public.get_today_practice_summary(uuid,timestamptz)','execute'),'browser cannot select another owner through queue RPC');
select extensions.ok(has_function_privilege('service_role','public.list_today_practice_items(uuid,timestamptz,integer,integer)','execute'),'server can read owned page');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T00:00:00Z')->>'newCount')::integer,0,'unknown owner has empty new pool');
select extensions.is(public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T00:00:00Z')->'nextPracticeAt','null'::jsonb,'no fabricated next due');
select extensions.is(private.today_candidate_id('10000000-0000-4000-8000-000000000001','h:save:mark')::text,'8818ffca-a153-503a-a9c6-2cea4f075bad','SQL stable candidate identity matches the TypeScript golden vector');
create temp table today_fixture(name text primary key,id uuid);
do $$
declare owner_id uuid:='29000000-0000-4000-8000-000000000001'; other_id uuid:='29000000-0000-4000-8000-000000000002';
 source_id uuid:='29100000-0000-4000-8000-000000000001'; save_id uuid:='29200000-0000-4000-8000-000000000001'; artifact_id uuid:='29300000-0000-4000-8000-000000000001'; snapshot_id uuid:='29400000-0000-4000-8000-000000000001';
 card jsonb; cards jsonb; alt uuid; sense uuid; expression uuid; review uuid; draft uuid; future uuid; result jsonb; i integer;
begin
 insert into auth.users(id,email,aud,role) values(owner_id,'today-a@popcorn.test','authenticated','authenticated'),(other_id,'today-b@popcorn.test','authenticated','authenticated');
 insert into public.profiles(user_id) values(owner_id),(other_id) on conflict do nothing;
 insert into public.video_sources(id,user_id,youtube_video_id,canonical_url,created_at) values(source_id,owner_id,'dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','2026-01-01');
 insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
 values(snapshot_id,owner_id,source_id,'Old source saved again','Fixture','https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',20,'Fixture','zh-CN',repeat('a',64),'2026-11-01T00:00:00Z');
 insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language) values(owner_id,snapshot_id,'today-seg',0,'太离谱了，说白了。',1,2,'zh-CN');
 insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values(save_id,owner_id,source_id,snapshot_id,gen_random_uuid(),'dQw4w9WgXcQ','subtitle_row','ready','2026-11-01T00:00:00Z',1,'{"segmentId":"today-seg","originalChinese":"太离谱了，说白了。","startSeconds":1,"endSeconds":2,"contextBefore":[],"contextAfter":[]}');
 card:=jsonb_build_object('expression','太离谱了','englishMeaning','Outrageous.','englishExplanation','React to something extreme.','tone','Casual.','communicativeFunction','React','register','Casual',
  'evidenceText','太离谱了，说白了。','segmentIds',jsonb_build_array('today-seg'),'startSeconds',1,'endSeconds',2,'meaningHere','Outrageous.','useItWhen','React to something extreme.','comparedWith','很奇怪 is neutral.','howItFits','Use this phrase in a clause.','toneAndWho','Casual with friends.','watchOut',null,'examples',null,'functionCategories',jsonb_build_array('react'),'usageSettings',jsonb_build_array('casual_chat'),'suitability','expression');
 select jsonb_agg(card||jsonb_build_object('highlightKey','key-'||n)) into cards from generate_series(1,206) n;
 insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
 values(artifact_id,owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',cards),'analyze-saved-item-v3','fixture/today',repeat('1',64),'2026-11-01T01:00:00Z');
 -- An older-only card must remain; duplicate keys must not inflate the count.
 insert into public.generated_artifacts(user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
 values(owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(card||jsonb_build_object('highlightKey','key-1','meaningHere','Old meaning.'),card||jsonb_build_object('highlightKey','old-only'))),'analyze-saved-item-v3','fixture/today',repeat('2',64),'2026-11-01T00:30:00Z');
 insert into public.generated_artifacts(user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
 values(owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array((card-'howItFits')||jsonb_build_object('highlightKey','key-1'))),'analyze-saved-item-v3','fixture/today',repeat('3',64),'2026-11-01T02:00:00Z');
 -- Explicit Practice restores not_expression; an untouched sibling is not New.
 alt:=gen_random_uuid();
 insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
 values(alt,owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(card||jsonb_build_object('highlightKey','not-unopened','suitability','not_expression','notExpressionReasonEn','A basic form.'),card||jsonb_build_object('highlightKey','not-open','suitability','not_expression','notExpressionReasonEn','A basic form.'))),'analyze-saved-item-v3','fixture/today',repeat('4',64));
 draft:=gen_random_uuid();insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english)
 values(draft,owner_id,source_id,save_id,alt,1,gen_random_uuid(),'en','zh-CN','太离谱了','朋友问你对咖啡价格怎么看？','React naturally.','Use it.');
 insert into today_fixture values('not-open',draft);
 -- Unknown legacy suitability stays unknown until explicitly opened.
 alt:=gen_random_uuid();card:=card-'meaningHere'-'useItWhen'-'comparedWith'-'howItFits'-'toneAndWho'-'watchOut'-'examples'-'functionCategories'-'usageSettings'-'suitability';card:=card||jsonb_build_object('confidence',1);
 insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
 values(alt,owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(card,card)),'analyze-saved-item-v1','fixture/today',repeat('5',64));
 insert into public.practice_drafts(user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english)
 values(owner_id,source_id,save_id,alt,1,gen_random_uuid(),'en','zh-CN','太离谱了','同事问你对午餐价格怎么看？','React naturally.','Use it.');
 for i in 2..5 loop
  draft:=gen_random_uuid();future:=gen_random_uuid();
  insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,retry_due_at)
  values(draft,owner_id,source_id,save_id,artifact_id,i-1,future,'en','zh-CN','太离谱了','这是第'||i||'道价格情境，你怎么看？','React naturally.','Use it.',case when i=2 then 'removed' when i=3 then 'retry_scheduled' else 'open' end,case when i=4 then 2 else 1 end,case when i=3 then '2026-10-31T00:00:00Z'::timestamptz when i=4 then '2026-11-02T01:00:00Z'::timestamptz else null end);
  insert into today_fixture values(case i when 2 then 'removed' when 3 then 'retry' when 4 then 'future-open' else 'promoted' end,draft);
  if i=5 then
   result:=public.record_practice_round_attempt(owner_id,jsonb_build_object('id',gen_random_uuid(),'user_id',owner_id,'practice_draft_id',draft,'future_user_expression_id',future,'revision',1,'response_chinese','这也太离谱了。','accuracy_score',4,'accuracy_feedback_english','Accurate.','naturalness_score',4,'naturalness_feedback_english','Natural.','contextual_fit_score',4,'contextual_fit_feedback_english','Fits.','submitted_at','2026-11-01T00:00:00Z','created_at','2026-11-01T00:00:00Z'));
  end if;
 end loop;
 -- More than100 canonical due items, independent of first-practice candidates.
 for i in 1..101 loop
  sense:=gen_random_uuid();expression:=gen_random_uuid();review:=gen_random_uuid();
  insert into public.expression_senses(id,user_id,video_source_id,saved_item_id,expression_text,normalized_expression_text,english_meaning,english_explanation,tone,communicative_function,register)
  values(sense,owner_id,source_id,save_id,'说白了','说白了','Put simply.','Explain plainly.','Casual.','Explain.','Casual.');
  insert into public.user_expressions(id,user_id,expression_sense_id,mastery_state) values(expression,owner_id,sense,'tried');
  insert into public.review_tasks(id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes) values(review,owner_id,expression,'tried','pending','2026-10-01T00:00:00Z'::timestamptz+make_interval(mins=>i),1,0);
 end loop;
 -- More than100 recently-created sources must not hide an older source saved now.
 for i in 1..101 loop
  alt:=gen_random_uuid();
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url,created_at) values(alt,owner_id,lpad(i::text,11,'0'),'https://www.youtube.com/watch?v='||lpad(i::text,11,'0'),'2026-10-31');
  insert into public.saved_items(user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload) values(owner_id,alt,gen_random_uuid(),lpad(i::text,11,'0'),'player_moment','ready','2026-10-30T00:00:00Z'::timestamptz+make_interval(mins=>i),0,'{"capturedSecond":0}');
 end loop;
end $$;

-- Match the actual CandidateExpressionSchema when selecting the latest valid
-- historical version. Bad optional metadata must not mask an older good card.
create temp table today_card as select content->'candidates'->0 as card from public.generated_artifacts where id='29300000-0000-4000-8000-000000000001';
select extensions.ok(not private.today_valid_card(card||jsonb_build_object('englishMeaning',repeat('a',2001))),'modern compatibility prose keeps its schema length bound') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"confidence":"bad"}'::jsonb),'invalid optional confidence is not a valid latest card') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"highlightId":"bad"}'::jsonb),'invalid optional highlight UUID is not a valid latest card') from today_card;
select extensions.ok(not private.today_valid_card(card||jsonb_build_object('highlightKey',repeat('a',30001))),'stable highlight key keeps its schema length bound') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"usageSettings":[null]}'::jsonb),'null setting cannot pass SQL three-valued enum comparison') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"functionCategories":[null]}'::jsonb),'null function cannot pass SQL three-valued enum comparison') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"segmentIds":[" today-seg "]}'::jsonb),'stable segment IDs cannot have surrounding whitespace') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"notExpressionReasonEn":123}'::jsonb),'optional expression reason still has the declared type') from today_card;
select extensions.ok(not private.today_valid_card(card||'{"unexpected":true}'::jsonb),'unknown candidate fields follow the strict object schema') from today_card;
select extensions.ok(private.today_valid_card(card||'{"examples":[{"zh":"你好。","en":"Hello."},{"zh":"再见。","en":"Goodbye."}]}'::jsonb),'readable candidate examples follow schema rather than adding a new substring rule') from today_card;
select extensions.ok(private.today_valid_card(card||'{"meaningHere":"v"}'::jsonb),'literal English v must not be mistaken for vertical-tab whitespace') from today_card;

select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'reviewCount')::integer,101,'all101 reviews count beyond old100 cap');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'newCount')::integer,205,'all205 New retain older card and explicit legacy/not_expression while excluding removed/promoted/future');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'secondTryCount')::integer,1,'only due retry enters automatic Second try');
select extensions.is(jsonb_array_length(public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',0,200)),200,'first page contains200');
select extensions.is(jsonb_array_length(public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',200,200)),107,'second page retains remaining107');
select extensions.is(public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',0,200)->0->>'kind','review','Review is first');
select extensions.is(public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',0,200)->101->>'kind','second_try','Second try follows101 reviews');
select extensions.is(public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',0,200)->101->>'roundNumber','2','stored retry round1 displays upcoming Round2');
select extensions.is(public.list_today_practice_videos('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',false,0,3)->0->>'sourceId','29100000-0000-4000-8000-000000000001','recent3 uses latest save across102 sources not source creation cap');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000002','2026-11-01T12:00:00Z')->>'estimatedMinutes')::integer,0,'other owner receives no queue rows/counts');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',array(select (q.item->>'id')::uuid from private.today_practice_rows('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z') q limit 301),null,null)->>'remainingCount')::integer,6,'next handles301 excluded IDs without hidden200 cap');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='future-open'))),(select id from today_fixture where name='future-open'))->>'resumed')::boolean,true,'current latest future-open manual round restores without auto-enrolling');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='future-open'))),(select id from today_fixture where name='future-open'))->>'remainingCount')::integer,308,'manual current counts once beyond ordinary307');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000002','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='future-open'))),(select id from today_fixture where name='future-open'))->>'resumed')::boolean,false,'foreign current hint is ignored');
select extensions.throws_ok($$select public.list_today_practice_items('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',0,201)$$,'22023','invalid today page','DB page maximum is200 not total queue maximum');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='not-open'))),(select id from today_fixture where name='not-open'))->'item'->>'currentTaskId'),(select id::text from today_fixture where name='not-open'),'open first round resumes exact same task even for explicit not_expression');
do $$
declare d jsonb;new_id uuid:=gen_random_uuid();
begin
 select to_jsonb(row) into d from public.practice_drafts row where id=(select id from today_fixture where name='retry');
 perform public.create_practice_round('29000000-0000-4000-8000-000000000001',d||jsonb_build_object('id',new_id,'future_user_expression_id',gen_random_uuid(),'prompt_chinese','同学说面包价格又涨了，你怎么看？','created_at','2026-11-01T12:00:00Z','updated_at','2026-11-01T12:00:00Z'),gen_random_uuid());
 insert into today_fixture values('open-second',new_id);
end $$;
select extensions.is((select (q.item->>'roundNumber')::integer from private.today_practice_rows('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z') q where q.priority=1),2,'retry rowRound2 becomes actual openRound2 without adding a queue item');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='open-second'))),(select id from today_fixture where name='retry'))->>'resumed')::boolean,false,'old superseded task hint cannot replace latest round');
select extensions.is((public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',private.today_candidate_id('29000000-0000-4000-8000-000000000001',(select candidate_key from public.practice_drafts where id=(select id from today_fixture where name='open-second'))),(select id from today_fixture where name='open-second'))->>'remainingCount')::integer,307,'resuming eligible open2 counts current only once');
do $$
declare owner_id uuid:='29000000-0000-4000-8000-000000000001';source_id uuid:='29100000-0000-4000-8000-000000000001';saved uuid:=gen_random_uuid(); status text;
begin
 insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values(saved,owner_id,source_id,'29400000-0000-4000-8000-000000000001',gen_random_uuid(),'dQw4w9WgXcQ','subtitle_row','ready','2026-10-31',1,'{"segmentId":"today-seg","originalChinese":"太离谱了，说白了。","startSeconds":1,"endSeconds":2,"contextBefore":[],"contextAfter":[]}');
 insert into public.saved_item_highlights(user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin)
 values(owner_id,saved,'today-seg',0,'today-seg',4,'太离谱了','user'),(owner_id,saved,'today-seg',5,'today-seg',8,'说白了','user');
 foreach status in array array['saved','failed','unsupported'] loop
  insert into public.saved_items(user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
  values(owner_id,source_id,gen_random_uuid(),'dQw4w9WgXcQ','player_moment',status,'2026-10-31',0,'{"capturedSecond":0}');
 end loop;
end $$;
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'needsAnalysisCount')::integer,1,'two active unanalysed marks count one actionable save');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'processingCount')::integer,2,'secondary processing includes failed and excludes unsupported');
select extensions.is(jsonb_array_length(public.list_today_practice_videos('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',true,0,200)),1,'needs-analysis filter uses same exact source predicate');
select extensions.is(public.list_today_practice_videos('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',true,0,200)->0->>'needsAnalysisCount','1','per-video analysis count agrees with summary');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'nextPracticeAt')::timestamptz,'2026-11-02T00:00:00Z'::timestamptz,'future next date is actual minimum review/retry time');
select extensions.throws_ok($$select public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z',array[null::uuid],null,null)$$,'22023','invalid today excludes','null exclude must fail rather than silently hiding the whole queue');
-- Analyzed cards survive mark removal, and exact location+text survives a
-- removed/recreated mark ID. Active marks only control needs-analysis.
do $$
declare mark uuid:=gen_random_uuid();card jsonb;
begin
 insert into public.saved_item_highlights(id,user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin)
 values(mark,'29000000-0000-4000-8000-000000000001','29200000-0000-4000-8000-000000000001','today-seg',0,'today-seg',4,'太离谱了','user');
 insert into today_fixture values('covered-highlight',mark);
 select c.card||jsonb_build_object('highlightId',mark,'highlightKey','["today-seg",0,"today-seg",4,"太离谱了"]') into card from today_card c;
 insert into public.generated_artifacts(user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
 values('29000000-0000-4000-8000-000000000001','29100000-0000-4000-8000-000000000001','29200000-0000-4000-8000-000000000001','saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(card)),'analyze-saved-item-v3','fixture/today',repeat('6',64));
end $$;
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'needsAnalysisCount')::integer,1,'covered active mark is not a missing analysis');
update public.saved_item_highlights set status='removed',removed_at='2026-11-01T12:00:00Z' where id=(select id from today_fixture where name='covered-highlight');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'newCount')::integer,206,'removing a mark retains the generated New card');
insert into public.saved_item_highlights(user_id,saved_item_id,start_segment_id,start_offset,end_segment_id,end_offset,text,origin)
values('29000000-0000-4000-8000-000000000001','29200000-0000-4000-8000-000000000001','today-seg',0,'today-seg',4,'太离谱了','user');
select extensions.is((public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')->>'needsAnalysisCount')::integer,1,'recreated mark matches compact JSON identity despite a different ID');
select extensions.ok((select bool_and(not has_function_privilege('authenticated',f,'execute') and not has_function_privilege('anon',f,'execute') and has_function_privilege('service_role',f,'execute')) from unnest(array['public.get_today_practice_summary(uuid,timestamptz)','public.list_today_practice_items(uuid,timestamptz,integer,integer)','public.get_today_practice_next(uuid,timestamptz,uuid[],uuid,uuid)','public.list_today_practice_videos(uuid,timestamptz,boolean,integer,integer)']) f),'all four public queue RPCs are server-only');
set local role authenticated;
select extensions.throws_ok($$select public.get_today_practice_summary('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z')$$,'42501',null,'authenticated role cannot choose another owner');
reset role;
set local role anon;
select extensions.throws_ok($$select public.get_today_practice_next('29000000-0000-4000-8000-000000000001','2026-11-01T12:00:00Z','{}',null,null)$$,'42501',null,'anonymous role cannot read next');
reset role;
select * from extensions.finish();
rollback;
