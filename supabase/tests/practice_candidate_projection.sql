begin;
select extensions.no_plan();
select extensions.has_function('public','get_practice_candidate_projection',array['uuid','text[]'],'Saved has a bounded lightweight projection RPC');
select extensions.ok(has_function_privilege('service_role','public.get_practice_candidate_projection(uuid,text[])','EXECUTE'),'server may project candidate states');
select extensions.ok(not has_function_privilege('authenticated','public.get_practice_candidate_projection(uuid,text[])','EXECUTE'),'authenticated browser cannot call service projection');
select extensions.ok(not has_function_privilege('anon','public.get_practice_candidate_projection(uuid,text[])','EXECUTE'),'anonymous browser cannot call service projection');

\set owner_a '28000000-0000-4000-8000-000000000001'
\set owner_b '28000000-0000-4000-8000-000000000002'
\set source_id '28100000-0000-4000-8000-000000000001'
\set save_id '28200000-0000-4000-8000-000000000001'
\set artifact_id '28300000-0000-4000-8000-000000000001'
\set draft_a '28400000-0000-4000-8000-000000000001'
\set draft_b '28400000-0000-4000-8000-000000000002'
\set draft_c '28400000-0000-4000-8000-000000000003'
\set expression_a '28500000-0000-4000-8000-000000000001'
\set expression_b '28500000-0000-4000-8000-000000000002'
\set expression_c '28500000-0000-4000-8000-000000000003'
\set snapshot_id '28600000-0000-4000-8000-000000000001'
\set attempt_id '28700000-0000-4000-8000-000000000001'
\set key_a 'l:28200000-0000-4000-8000-000000000001:28300000-0000-4000-8000-000000000001:0'
\set key_b 'l:28200000-0000-4000-8000-000000000001:28300000-0000-4000-8000-000000000001:1'

insert into auth.users(id,email,aud,role) values
  (:'owner_a','projection-a@popcorn.test','authenticated','authenticated'),
  (:'owner_b','projection-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values(:'owner_a'),(:'owner_b') on conflict do nothing;
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url)
values(:'source_id',:'owner_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ');
insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
values(:'snapshot_id',:'owner_a',:'source_id','Projection fixture','Fixture','https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',20,'Fixture','zh-CN',repeat('1',64),'2026-11-01T00:00:00Z');
insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
values(:'owner_a',:'snapshot_id','projection-segment',0,'说白了，这也太离谱了。',1,2,'zh-CN');
insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
values(:'save_id',:'owner_a',:'source_id',:'snapshot_id','28800000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row','ready','2026-11-01T00:00:00Z',1,
  '{"segmentId":"projection-segment","originalChinese":"说白了，这也太离谱了。","startSeconds":1,"endSeconds":2,"contextBefore":[],"contextAfter":[]}');
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
values(:'artifact_id',:'owner_a',:'source_id',:'save_id','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了","englishMeaning":"Outrageous.","englishExplanation":"React to something extreme.","tone":"Casual.","communicativeFunction":"React","register":"Casual","evidenceText":"说白了，这也太离谱了。","segmentIds":["projection-segment"],"startSeconds":1,"endSeconds":2,"confidence":1},{"expression":"说白了","englishMeaning":"Put simply.","englishExplanation":"Explain plainly.","tone":"Casual.","communicativeFunction":"Explain","register":"Casual","evidenceText":"说白了，这也太离谱了。","segmentIds":["projection-segment"],"startSeconds":1,"endSeconds":2,"confidence":1}]}',
  'analyze-saved-item-v1','fixture/projection',repeat('2',64));
insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id)
values
  (:'draft_a',:'owner_a',:'source_id',:'save_id',:'artifact_id',0,:'expression_a','en','zh-CN','太离谱了','朋友说咖啡要六十元，你怎么看？','React to your friend.','Use the expression.','open',1,null),
  (:'draft_b',:'owner_a',:'source_id',:'save_id',:'artifact_id',1,:'expression_b','en','zh-CN','说白了','同事没听懂这个办法，你怎么说明？','Explain to your coworker.','Use the expression.','superseded',1,null),
  (:'draft_c',:'owner_a',:'source_id',:'save_id',:'artifact_id',1,:'expression_c','en','zh-CN','说白了','朋友没听懂路线，你怎么说明？','Explain to your friend.','Use the expression.','removed',2,:'draft_b');
select public.record_practice_round_attempt(:'owner_a',jsonb_build_object(
  'id',:'attempt_id','user_id',:'owner_a','practice_draft_id',:'draft_a','future_user_expression_id',:'expression_a',
  'revision',1,'response_chinese','这也太离谱了。','accuracy_score',4,'accuracy_feedback_english','Accurate.',
  'naturalness_score',4,'naturalness_feedback_english','Natural.','contextual_fit_score',4,'contextual_fit_feedback_english','Fits.',
  'submitted_at','2026-11-01T01:00:00Z','created_at','2026-11-01T01:00:00Z')) is not null as fixture_recorded;

set local role service_role;
select extensions.results_eq(
  format('select task_id,round_number,status,user_expression_id from public.get_practice_candidate_projection(%L,array[%L])',:'owner_a',:'key_a'),
  format('values (%L::uuid,1,%L::text,%L::uuid)',:'draft_a','promoted',:'expression_a'),
  'projection retains actual promotion identity without reading answer/history payload');
select extensions.results_eq(
  format('select task_id,round_number,status,user_expression_id from public.get_practice_candidate_projection(%L,array[%L])',:'owner_a',:'key_b'),
  format('values (%L::uuid,2,%L::text,null::uuid)',:'draft_c','removed'),
  'projection picks latest removed round while retaining candidate history identity');
select extensions.results_eq(
  format('select task_id,round_number,status,user_expression_id from public.get_practice_candidate_projection(%L,array[%L,%L]) order by candidate_key',:'owner_b',:'key_a',:'key_b'),
  $$values (null::uuid,null::integer,null::text,null::uuid),(null::uuid,null::integer,null::text,null::uuid)$$,
  'another owner cannot observe either a private promotion or a live draft');
select extensions.is((select count(*)::integer from public.get_practice_candidate_projection(:'owner_a',array[:'key_a',:'key_a'])),1,'duplicate keys produce one state row');
select extensions.is((select count(*)::integer from public.get_practice_candidate_projection(:'owner_a',array[]::text[])),0,'empty key set produces no work');
select extensions.is((select count(*)::integer from public.get_practice_candidate_projection(:'owner_a',array(select 'unknown-'||n from generate_series(1,200) n))),200,'a full bounded batch returns all200 requested identities');
select extensions.results_eq(
  format('select array(select jsonb_object_keys(to_jsonb(p)) order by 1) from public.get_practice_candidate_projection(%L,array[%L]) p',:'owner_a',:'key_a'),
  $$values (array['candidate_key','round_number','status','task_id','user_expression_id']::text[])$$,
  'projection contains exactly five identity/status fields, no situations/coaching/answers');
select extensions.throws_ok(
  format('select * from public.get_practice_candidate_projection(%L,array_fill(%L::text,array[201]))',:'owner_a',:'key_a'),
  '22023','invalid candidate projection batch','database rejects batches larger than200');
select extensions.throws_ok(
  format('select * from public.get_practice_candidate_projection(%L,array[null::text])',:'owner_a'),
  '22023','invalid candidate projection batch','database rejects null keys');
select extensions.results_eq(
  format('select task_id,round_number,status,user_expression_id from public.get_practice_candidate_projection(%L,array[%L])',:'owner_a','unknown-candidate'),
  $$values (null::uuid,null::integer,null::text,null::uuid)$$,'unknown key is unpracticed without exposing other data');
reset role;
set local role authenticated;
select extensions.throws_ok(
  format('select * from public.get_practice_candidate_projection(%L,array[%L])',:'owner_a',:'key_a'),
  '42501',null,'authenticated role cannot bypass server owner selection');
reset role;
set local role anon;
select extensions.throws_ok(
  format('select * from public.get_practice_candidate_projection(%L,array[%L])',:'owner_a',:'key_a'),
  '42501',null,'anonymous role cannot inspect the projection');
reset role;
select * from extensions.finish();
rollback;
