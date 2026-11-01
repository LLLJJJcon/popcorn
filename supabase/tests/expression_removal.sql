begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '0d000000-0000-4000-8000-00000000a001'
\set user_b '0d000000-0000-4000-8000-00000000b002'
\set source_a1 '0d100000-0000-4000-8000-000000000001'
\set source_a2 '0d100000-0000-4000-8000-000000000002'
\set source_b '0d100000-0000-4000-8000-000000000003'

select extensions.has_function(
  'public',
  'search_expressions',
  array[
    'uuid','text','text','text','uuid','text',
    'timestamp with time zone','timestamp with time zone','integer'
  ],
  'bounded expression search RPC exists'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'expression-search-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'expression-search-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles (user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources (id,user_id,youtube_video_id,canonical_url,created_at,updated_at) values
  (:'source_a1',:'user_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','2026-08-01','2026-08-01'),
  (:'source_a2',:'user_a','M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE','2026-08-01','2026-08-01'),
  (:'source_b',:'user_b','aqz-KE-bpKQ','https://www.youtube.com/watch?v=aqz-KE-bpKQ','2026-08-01','2026-08-01');

insert into public.expression_senses (
  id,user_id,video_source_id,expression_text,normalized_expression_text,
  english_meaning,english_explanation,tone,communicative_function,register,
  created_at,updated_at
) values
  ('0d200000-0000-4000-8000-000000000001',:'user_a',:'source_a1','太离谱了','太离谱了',
   'absurd','Used as a reaction to something unreasonable.','surprised','reaction','informal','2026-08-01','2026-08-01'),
  ('0d200000-0000-4000-8000-000000000002',:'user_a',:'source_a2','太 离谱了。','太 离谱了。',
   'outrageous','A spaced source rendering of the same expression.','surprised','reaction','informal','2026-08-02','2026-08-02'),
  ('0d200000-0000-4000-8000-000000000003',:'user_a',:'source_a1','太离谱了吧','太离谱了吧',
   'that is outrageous','A longer reaction.','surprised','reaction','informal','2026-08-03','2026-08-03'),
  ('0d200000-0000-4000-8000-000000000004',:'user_a',:'source_a1','这太离谱了','这太离谱了',
   'this is outrageous','A reaction with a demonstrative.','surprised','reaction','informal','2026-08-04','2026-08-04'),
  ('0d200000-0000-4000-8000-000000000005',:'user_a',:'source_a1','太离普了','太离普了',
   'near typo fixture','A lexical near match.','surprised','reaction','informal','2026-08-05','2026-08-05'),
  ('0d200000-0000-4000-8000-000000000006',:'user_a',:'source_a2','莫名其妙','莫名其妙',
   'absurd and baffling','Used when something makes no sense.','confused','disagreement','casual','2026-08-06','2026-08-06'),
  ('0d200000-0000-4000-8000-000000000007',:'user_a',:'source_a2','麻烦你了','麻烦你了',
   'sorry to trouble you','A polite request formula.','polite','polite request','polite','2026-08-07','2026-08-07'),
  ('0d200000-0000-4000-8000-000000000008',:'user_b',:'source_b','太离谱了','太离谱了',
   'absurd','A closer other-owner result.','surprised','reaction','informal','2026-08-20','2026-08-20');

insert into public.user_expressions (
  id,user_id,expression_sense_id,mastery_state,created_at,updated_at
) values
  ('0d300000-0000-4000-8000-000000000001',:'user_a','0d200000-0000-4000-8000-000000000001','tried','2026-08-01','2026-08-02'),
  ('0d300000-0000-4000-8000-000000000002',:'user_a','0d200000-0000-4000-8000-000000000002','reused','2026-08-02','2026-08-02'),
  ('0d300000-0000-4000-8000-000000000003',:'user_a','0d200000-0000-4000-8000-000000000003','tried','2026-08-03','2026-08-03'),
  ('0d300000-0000-4000-8000-000000000004',:'user_a','0d200000-0000-4000-8000-000000000004','owned','2026-08-04','2026-08-04'),
  ('0d300000-0000-4000-8000-000000000005',:'user_a','0d200000-0000-4000-8000-000000000005','tried','2026-08-05','2026-08-05'),
  ('0d300000-0000-4000-8000-000000000006',:'user_a','0d200000-0000-4000-8000-000000000006','reused','2026-08-06','2026-08-06'),
  ('0d300000-0000-4000-8000-000000000007',:'user_a','0d200000-0000-4000-8000-000000000007','owned','2026-08-07','2026-08-07'),
  ('0d300000-0000-4000-8000-000000000008',:'user_b','0d200000-0000-4000-8000-000000000008','owned','2026-08-20','2026-08-20');


\set saved '0d400000-0000-4000-8000-000000000001'
\set artifact '0d500000-0000-4000-8000-000000000001'
\set expression '0d300000-0000-4000-8000-000000000001'
insert into public.saved_items(id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
values(:'saved',:'user_a',:'source_a1','0d600000-0000-4000-8000-000000000001','dQw4w9WgXcQ','player_moment','saved',now(),10,'{"capturedSecond":10}');
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
values(:'artifact',:'user_a',:'source_a1',:'saved','saved_item_analysis','en','zh-CN',
'{"candidates":[{"expression":"太离谱了","highlightKey":"stable-mark-key"},{"expression":"难怪"}]}','analyze-saved-item-v3','fixture',repeat('b',64));
insert into public.review_tasks(id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes)
values('0d700000-0000-4000-8000-000000000001',:'user_a',:'expression','tried','pending',now(),1,0);
insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english)
values('0d800000-0000-4000-8000-000000000001',:'user_a',:'expression','use_it_now','en','zh-CN','太离谱了','怎么评价这个价格？','Reply in Chinese.','Use the expression.');
insert into public.attempts(id,user_id,practice_task_id,user_expression_id,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at)
values('0d900000-0000-4000-8000-000000000001',:'user_a','0d800000-0000-4000-8000-000000000001',:'expression','这太离谱了。',true,5,'Correct.',5,'Natural.',5,'Fits.',true,'none',now());

select extensions.is(public.remove_saved_expression(:'user_b',:'saved',:'artifact',0),null::text,'another owner cannot remove a saved expression');
select extensions.is(public.remove_saved_expression(:'user_a',:'saved',:'artifact',99),null::text,'invalid candidate index changes nothing');
select extensions.is(public.remove_saved_expression(:'user_a',:'saved',:'artifact',0),'stable-mark-key','mark identity survives artifact refresh');
select extensions.is(public.remove_saved_expression(:'user_a',:'saved',:'artifact',0),'stable-mark-key','repeat removal is idempotent');
select extensions.is((select cardinality(removed_expression_keys) from public.saved_items where id=:'saved'),1,'repeat removal does not duplicate keys');
select extensions.is(public.remove_saved_expression(:'user_a',:'saved',:'artifact',1),'legacy:难怪','legacy candidates have stable removal keys');
select extensions.is((select jsonb_array_length(content->'candidates') from public.generated_artifacts where id=:'artifact'),2,'immutable candidate array and indices stay intact');
select extensions.ok(not public.remove_vault_expression(:'user_b',:'expression'),'another owner cannot delete from Vault');
select extensions.ok(public.remove_vault_expression(:'user_a',:'expression'),'owner can remove Vault entry');
select extensions.ok(public.remove_vault_expression(:'user_a',:'expression'),'Vault removal is idempotent');
select extensions.is((select status from public.review_tasks where user_expression_id=:'expression'),'cancelled','pending reviews are cancelled');
select extensions.is((select count(*)::integer from public.attempts where user_expression_id=:'expression'),1,'past practice attempt is preserved');
select extensions.is((select count(*)::integer from public.search_expressions(:'user_a','') where user_expression_id=:'expression'),0,'deleted entry cannot reappear in search');
select extensions.is((select count(*)::integer from public.saved_items where id=:'saved'),1,'Vault deletion preserves Saved');
select extensions.ok(not has_function_privilege('authenticated','public.remove_vault_expression(uuid,uuid)','execute'),'browser role cannot bypass the server owner check');
select extensions.ok(not has_function_privilege('anon','public.remove_saved_expression(uuid,uuid,uuid,integer)','execute'),'anonymous role cannot remove learning cards');
-- A real readable card must disappear consistently from all Today projections.
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
values('0d500000-0000-4000-8000-000000000002',:'user_a',:'source_a1',:'saved','saved_item_analysis','en','zh-CN',
jsonb_build_object('candidates',jsonb_build_array(jsonb_build_object(
'expression','太离谱了','englishMeaning','Outrageous.','englishExplanation','React to something extreme.','tone','Casual.','communicativeFunction','React','register','Casual',
'evidenceText','太离谱了，说白了。','segmentIds',jsonb_build_array('fixture-seg'),'startSeconds',1,'endSeconds',2,'meaningHere','Outrageous.','useItWhen','React to something extreme.','comparedWith','很奇怪 is neutral.',
'howItFits','Use this phrase in a clause.','toneAndWho','Casual with friends.','watchOut',null,'examples',null,'functionCategories',jsonb_build_array('react'),'usageSettings',jsonb_build_array('casual_chat'),'suitability','expression','highlightKey','today-removal-key'))),
'analyze-saved-item-v3','fixture',repeat('c',64));
select extensions.is((public.get_today_practice_summary(:'user_a',now())->>'newCount')::integer,1,'readable card is eligible before removal');
select extensions.is(public.remove_saved_expression(:'user_a',:'saved','0d500000-0000-4000-8000-000000000002',0),'today-removal-key','owner removes readable card');
select extensions.is((public.get_today_practice_summary(:'user_a',now())->>'newCount')::integer,0,'Today count excludes removed Saved card');
select extensions.is(jsonb_array_length(public.list_today_practice_items(:'user_a',now(),0,200)),0,'Today page excludes removed card');
select extensions.is((public.get_today_practice_next(:'user_a',now(),'{}',null,null)->>'remainingCount')::integer,0,'Today next excludes removed card');
select extensions.throws_ok(format('select public.create_practice_round(%L,%L::jsonb,null)',:'user_a',jsonb_build_object(
'user_id',:'user_a','saved_item_id',:'saved','candidate_artifact_id','0d500000-0000-4000-8000-000000000002','candidate_index',0,
'candidate_key','h:'||:'saved'||':'||encode(extensions.digest(convert_to('today-removal-key','UTF8'),'sha256'),'hex'))::text),
'P0001','Saved expression was removed','database publication rechecks removal after model work');

select * from extensions.finish();
rollback;
