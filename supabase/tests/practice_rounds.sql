begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
select has_column('public','practice_drafts','candidate_key','stable candidate identity exists');
select has_column('public','practice_drafts','round_number','round number exists');
select has_column('public','practice_drafts','examples_opened_at','examples assistance is durable');
select has_column('public','practice_draft_attempts','natural_version','natural coaching is durable');
select has_column('public','attempts','entry_round','formal entry round exists');
select has_function('public','record_practice_round_attempt',array['uuid','jsonb'],'answer/status/promotion atomic RPC exists');
select has_function('public','create_practice_round',array['uuid','jsonb','uuid'],'round/request transaction exists');
select ok(not has_function_privilege('authenticated','public.record_practice_round_attempt(uuid,jsonb)','EXECUTE'),'browser cannot write scored evidence');
select ok(not has_function_privilege('anon','public.create_practice_round(uuid,jsonb,uuid)','EXECUTE'),'anonymous round writes denied');
select ok(has_function_privilege('service_role','public.get_practice_round_state(uuid,uuid)','EXECUTE'),'server can recover feedback');
select is(public.get_practice_round_state('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),null::jsonb,'unknown owned round does not leak');
select is((select count(*)::integer from pg_indexes where schemaname='public' and indexname='practice_round_one_current'),1,'one current round is fenced');

\set user_a '16000000-0000-4000-8000-00000000a001'
\set user_b '16000000-0000-4000-8000-00000000b002'
\set practiced_source '16100000-0000-4000-8000-000000000001'
\set unpracticed_source '16200000-0000-4000-8000-000000000002'
\set rollback_source '16300000-0000-4000-8000-000000000003'
\set other_source '16400000-0000-4000-8000-000000000004'
\set snapshot '16500000-0000-4000-8000-000000000001'
\set segment '16600000-0000-4000-8000-000000000001'
\set practiced_save '16700000-0000-4000-8000-000000000001'
\set unpracticed_save '16700000-0000-4000-8000-000000000002'
\set rollback_save '16700000-0000-4000-8000-000000000003'
\set artifact '16800000-0000-4000-8000-000000000001'
\set draft '16900000-0000-4000-8000-000000000001'
\set future_expression '16a00000-0000-4000-8000-000000000001'
\set staged_attempt '16b00000-0000-4000-8000-000000000001'
\set practiced_job '16c00000-0000-4000-8000-000000000001'
\set unpracticed_job '16c00000-0000-4000-8000-000000000002'

select extensions.has_function(
  'public', 'delete_video_source',
  array['uuid','uuid','text','timestamp with time zone'],
  'service-only source deletion RPC exists'
);
select extensions.has_column(
  'public','expression_senses','source_deleted_at',
  'retained expression semantics expose an explicit source tombstone'
);
select extensions.has_column(
  'private','practice_promotion_receipts','deleted_occurrence_id',
  'immutable promotion replay retains the deleted occurrence identity without a live locator'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'round-lifecycle-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'round-lifecycle-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles (user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources (id,user_id,youtube_video_id,canonical_url) values
  (:'practiced_source',:'user_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'unpracticed_source',:'user_a','M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE'),
  (:'rollback_source',:'user_a','aqz-KE-bpKQ','https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
  (:'other_source',:'user_b','9bZkp7q19f0','https://www.youtube.com/watch?v=9bZkp7q19f0');

insert into public.video_snapshots (
  id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
  description,transcript_language,transcript_hash,captured_at
) values (
  :'snapshot',:'user_a',:'practiced_source','Secret source title','Secret channel',
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',120,'Secret source description',
  'zh-CN',repeat('1',64),'2026-08-22 09:00:00+00'
);
insert into public.transcript_segments (
  id,user_id,snapshot_id,stable_id,position,original_chinese,english_translation,
  start_seconds,end_seconds,language
) values (
  :'segment',:'user_a',:'snapshot','secret-segment',0,'这也太离谱了吧。',
  'This is outrageous.',10,12,'zh-CN'
);
insert into public.saved_items (
  id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,
  status,captured_at,start_seconds,payload
) values
  (:'practiced_save',:'user_a',:'practiced_source',:'snapshot',
   '16d00000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row','ready',
   '2026-08-22 09:00:00+00',10,
   '{"segmentId":"secret-segment","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb),
  (:'unpracticed_save',:'user_a',:'unpracticed_source',null,
   '16d00000-0000-4000-8000-000000000002','M7lc1UVf-VE','player_moment','saved',
   '2026-08-22 09:01:00+00',0,'{"capturedSecond":0}'::jsonb),
  (:'rollback_save',:'user_a',:'rollback_source',null,
   '16d00000-0000-4000-8000-000000000003','aqz-KE-bpKQ','player_moment','saved',
   '2026-08-22 09:02:00+00',0,'{"capturedSecond":0}'::jsonb);

insert into public.generated_artifacts (
  id,user_id,video_source_id,saved_item_id,artifact_type,native_language,
  target_language,content,prompt_version,model,result_key,created_at
) values (
  :'artifact',:'user_a',:'practiced_source',:'practiced_save','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了","englishMeaning":"outrageous","englishExplanation":"Used when something feels unreasonable.","tone":"surprised","communicativeFunction":"reacting to an unreasonable event","register":"informal","evidenceText":"这也太离谱了吧。","segmentIds":["secret-segment"],"startSeconds":10,"endSeconds":12,"confidence":0.96}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('2',64),'2026-08-22 09:03:00+00'
);

update public.generated_artifacts set content=jsonb_set(content,'{candidates,0,highlightKey}','"stable-round-mark"'::jsonb) where id=:'artifact';

insert into public.practice_drafts (
  id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
  future_user_expression_id,native_language,target_language,target_expression,
  prompt_chinese,instructions_english,goal_english,status,created_at,updated_at
) values (
  :'draft',:'user_a',:'practiced_source',:'practiced_save',:'artifact',0,
  :'future_expression','en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。',
  'Reply naturally in Mandarin.','Use the target expression.','open',
  '2026-08-22 09:04:00+00','2026-08-22 09:04:00+00'
);

-- Test builders only: all production behavior below is exercised through real
-- public RPCs, not a TypeScript mirror. Everything, including temporary DDL,
-- rolls back at the end of this test file.
create function pg_temp.round_attempt(p_task uuid,p_id uuid,p_text text,p_natural integer,p_revision integer default 1,p_at timestamptz default '2026-11-01T10:00:00Z') returns jsonb
language sql as $$
 select jsonb_build_object('id',p_id,'user_id',d.user_id,'practice_draft_id',d.id,'future_user_expression_id',d.future_user_expression_id,
  'revision',p_revision,'response_chinese',p_text,'passed',true,'accuracy_score',5,'accuracy_feedback_english','Correct meaning.',
  'naturalness_score',p_natural,'naturalness_feedback_english','Check the submitted wording.','contextual_fit_score',5,'contextual_fit_feedback_english','Fits the act.',
  'independent_use',true,'assistance_level','none','submitted_at',p_at,'created_at',p_at,'natural_version','这件事也太离谱了。')
 from public.practice_drafts d where d.id=p_task
$$;
create function pg_temp.round_payload(p_task uuid,p_new_id uuid,p_prompt text,p_artifact uuid default null) returns jsonb
language sql as $$
 select to_jsonb(d)||jsonb_build_object('id',p_new_id,'future_user_expression_id',gen_random_uuid(),'prompt_chinese',p_prompt,
  'candidate_artifact_id',coalesce(p_artifact,d.candidate_artifact_id),'candidate_key','untrusted-client-key',
  'created_at','2026-11-01T11:00:00Z','updated_at','2026-11-01T11:00:00Z')
 from public.practice_drafts d where d.id=p_task
$$;
create temp table round_results(name text primary key,value jsonb);

-- Non-empty legacy-data migration rehearsal. These independent artifact/index
-- identities represent separate pre-024 candidates; replay/cross-round cases
-- later deliberately retain the same highlight identity.
create temp table backfill_cases(kind text,legacy_status text,expected_status text,artifact_id uuid,draft_id uuid,attempt_id uuid);
do $$
declare base public.practice_drafts%rowtype; a public.generated_artifacts%rowtype; item record; aid uuid;did uuid;attempt uuid; row_data public.practice_drafts%rowtype;
begin
 select * into base from public.practice_drafts where id='16900000-0000-4000-8000-000000000001';
 select * into a from public.generated_artifacts where id=base.candidate_artifact_id;
 for item in select * from (values ('answered','active','retry_scheduled'),('receipt','completed','promoted'),('abandoned','abandoned','open'),('unanswered','active','open'),('no_receipt','completed','open')) x(kind,legacy_status,expected_status) loop
  aid:=gen_random_uuid();did:=gen_random_uuid();attempt:=gen_random_uuid();
  insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
   values(aid,a.user_id,a.video_source_id,a.saved_item_id,a.artifact_type,a.native_language,a.target_language,
    a.content #- '{candidates,0,highlightKey}',a.prompt_version,a.model,repeat(md5(aid::text),2),a.created_at);
  row_data:=jsonb_populate_record(null::public.practice_drafts,to_jsonb(base)||jsonb_build_object('id',did,'candidate_artifact_id',aid,'future_user_expression_id',gen_random_uuid()));
  insert into public.practice_drafts select row_data.*;
  if item.kind in('answered','receipt') then
   insert into public.practice_draft_attempts select (jsonb_populate_record(null::public.practice_draft_attempts,
     pg_temp.round_attempt(did,attempt,'这也太离谱了吧。',case when item.kind='receipt' then 5 else 2 end)
     ||jsonb_build_object('passed',item.kind='receipt','independent_use',item.kind='receipt'))).*;
   if item.kind='receipt' then perform public.promote_valid_practice_draft_attempt(base.user_id,attempt,'太离谱了','2026-11-02T10:00:00Z',1);end if;
  end if;
  insert into backfill_cases values(item.kind,item.legacy_status,item.expected_status,aid,did,attempt);
 end loop;
end $$;
create temp table backfill_graph_before as select
 (select count(*) from public.expression_senses) senses,(select count(*) from public.expression_occurrences) occurrences,
 (select count(*) from public.user_expressions) expressions,(select count(*) from public.practice_tasks) tasks,(select count(*) from public.attempts) attempts,
 (select count(*) from public.mastery_events) mastery,(select count(*) from public.review_tasks) reviews,
 (select count(*) from private.practice_promotion_receipts) receipts;
alter table public.practice_drafts drop constraint practice_draft_status_check;
alter table public.practice_drafts add constraint practice_draft_status_check check(status in('active','completed','abandoned','open','retry_scheduled','promoted','superseded','removed'));
update public.practice_drafts d set status=c.legacy_status,candidate_key='pre-024:'||d.id::text,scenario_fingerprint=repeat('a',64),retry_due_at='2027-01-01T00:00:00Z'
 from backfill_cases c where c.draft_id=d.id;
select extensions.is((select count(*)::integer from public.practice_drafts where status in('active','completed','abandoned')),5,'non-empty legacy active/completed/abandoned fixtures exist before backfill');
-- BEGIN VERBATIM 024 BACKFILL DML
update public.practice_drafts d set candidate_key=case
  when a.content->'candidates'->d.candidate_index->>'highlightKey' is not null
    then 'h:'||d.saved_item_id::text||':'||encode(extensions.digest(convert_to(a.content->'candidates'->d.candidate_index->>'highlightKey','UTF8'),'sha256'),'hex')
  else 'l:'||d.saved_item_id::text||':'||d.candidate_artifact_id::text||':'||d.candidate_index::text end,
  scenario_fingerprint=private.practice_situation_fingerprint(d.prompt_chinese)
from public.generated_artifacts a where a.id=d.candidate_artifact_id;
update public.practice_drafts d set status=case
  when exists(select 1 from private.practice_promotion_receipts r where r.practice_draft_id=d.id) then 'promoted'
  when exists(select 1 from public.practice_draft_attempts a where a.practice_draft_id=d.id and a.revision=1) then 'retry_scheduled'
  else 'open' end,
  retry_due_at=(select a.submitted_at+interval '24 hours' from public.practice_draft_attempts a
    where a.practice_draft_id=d.id and a.revision=1 and not exists(select 1 from private.practice_promotion_receipts r where r.practice_draft_id=d.id));
-- END VERBATIM 024 BACKFILL DML
select extensions.results_eq(
 $$select c.kind,d.status,d.round_number from backfill_cases c join public.practice_drafts d on d.id=c.draft_id order by c.kind$$,
 $$select kind,expected_status,1 from backfill_cases order by kind$$,
 '024 DML maps existing receipt/first-answer/remaining legacy rows to promoted/retry/open in round one');
select extensions.is((select d.retry_due_at from public.practice_drafts d join backfill_cases c on c.draft_id=d.id where c.kind='answered'),'2026-11-02T10:00:00Z'::timestamptz,'backfill retry is original first answer plus exactly 24h');
select extensions.ok((select bool_and(d.retry_due_at is null) from public.practice_drafts d join backfill_cases c on c.draft_id=d.id where c.kind<>'answered'),'backfill clears irrelevant retry dates for receipt and unanswered rows');
select extensions.ok((select bool_and(d.candidate_key='l:'||d.saved_item_id::text||':'||d.candidate_artifact_id::text||':0' and d.scenario_fingerprint=private.practice_situation_fingerprint(d.prompt_chinese)) from public.practice_drafts d join backfill_cases c on c.draft_id=d.id),'backfill reconstructs server artifact identity and real scenario fingerprints');
select extensions.results_eq(
 $$select (select count(*) from public.expression_senses),(select count(*) from public.expression_occurrences),(select count(*) from public.user_expressions),(select count(*) from public.practice_tasks),(select count(*) from public.attempts),(select count(*) from public.mastery_events),(select count(*) from public.review_tasks),(select count(*) from private.practice_promotion_receipts)$$,
 $$select senses,occurrences,expressions,tasks,attempts,mastery,reviews,receipts from backfill_graph_before$$,
 'non-empty legacy backfill creates no canonical graph rows or promotion receipts');
alter table public.practice_drafts drop constraint practice_draft_status_check;
alter table public.practice_drafts add constraint practice_draft_status_check check(status in('open','retry_scheduled','promoted','superseded','removed'));

select extensions.is(public.get_practice_round_state(:'user_a',:'draft')->>'status','open','unanswered first round remains open/New');
select extensions.is((public.get_practice_round_state(:'user_a',:'draft')->>'roundNumber')::integer,1,'unanswered first round does not increment on recovery');
select extensions.is(public.get_practice_round_state(:'user_b',:'draft'),null::jsonb,'wrong owner cannot recover the task');
insert into round_results values('reuse_open',public.create_practice_round(:'user_a',pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000090','这道请求不得替换尚未作答的题。'),'16f00000-0000-4000-8000-000000000001'));
select extensions.is((select value#>>'{draft,id}' from round_results where name='reuse_open'),:'draft','current unanswered round reuses original task');
select extensions.is((select (value->>'created')::boolean from round_results where name='reuse_open'),false,'open reuse is not a newly created round');

insert into round_results values('first',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt(:'draft',:'staged_attempt','这也太离谱了吧。',2)));
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')->>'status','retry_scheduled','failed first answer automatically schedules a second try');
select extensions.is((public.get_practice_round_state(:'user_a',:'draft')->>'retryDueAt')::timestamptz,'2026-11-02T10:00:00Z'::timestamptz,'default second try is first answer plus 24h');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')#>>'{firstAnswer,evaluation,assistanceLevel}','none','server derives no assistance without examples');
select extensions.is((public.get_practice_round_state(:'user_a',:'draft')#>>'{firstAnswer,evaluation,passed}')::boolean,false,'client true pass cannot override a dimension below three');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')#>>'{firstAnswer,naturalVersion}','这件事也太离谱了。','original coaching survives refresh');
insert into round_results values('same_first',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt(:'draft',gen_random_uuid(),'这也太离谱了吧。',5)));
select extensions.is((select (value->>'conflict')::boolean from round_results where name='same_first'),false,'identical original text replays instead of evaluating again');
insert into round_results values('different_first',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt(:'draft',gen_random_uuid(),'这个安排太离谱了。',5)));
select extensions.is((select (value->>'conflict')::boolean from round_results where name='different_first'),true,'different original text returns the existing-answer conflict');
select extensions.is((select value#>>'{attempt,id}' from round_results where name='different_first'),:'staged_attempt','conflict includes the original authoritative result');
select extensions.is((select count(*)::integer from public.practice_draft_attempts where practice_draft_id=:'draft'),1,'two-tab first-answer replay/conflict does not append attempts');
insert into round_results values('revision',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt(:'draft','16b00000-0000-4000-8000-000000000002','这件事也太离谱了。',4,999,'2026-11-01T10:30:00Z')));
select extensions.is((select (value#>>'{attempt,revision}')::integer from round_results where name='revision'),2,'server assigns the next revision within its round');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')#>>'{latestRevision,text}','这件事也太离谱了。','latest revision survives refresh beside the first answer');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')#>>'{firstAnswer,text}','这也太离谱了吧。','revision does not replace the original answer');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')->'promotion','null'::jsonb,'passing revision does not promote');
select extensions.is((public.get_practice_round_state(:'user_a',:'draft')->>'retryDueAt')::timestamptz,'2026-11-02T10:00:00Z'::timestamptz,'revision leaves the default retry time unchanged');
select extensions.throws_ok(format('select public.create_practice_round(%L,pg_temp.round_payload(%L,%L,%L),%L)',:'user_a',:'draft','16900000-0000-4000-8000-000000000091','朋友 告诉你一件很夸张的事!','16f00000-0000-4000-8000-000000000091'),'23505',null,'SQL rejects a whitespace/punctuation-only repeated scenario');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')->>'status','retry_scheduled','failed new-scenario publication preserves the previous retry round');

-- Reanalysis changes artifact ID but keeps the server-owned highlight identity.
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
select '16800000-0000-4000-8000-000000000002',user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,repeat('3',64),created_at from public.generated_artifacts where id=:'artifact';
insert into round_results values('round2',public.create_practice_round(:'user_a',pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000002','同事说打印机每天都会卡纸，问你怎么看。','16800000-0000-4000-8000-000000000002'),'16f00000-0000-4000-8000-000000000002'));
select extensions.is((select (value#>>'{draft,round_number}')::integer from round_results where name='round2'),2,'new scenario opens round two for the retained mark');
select extensions.is(public.get_practice_round_state(:'user_a',:'draft')->>'status','superseded','new round supersedes the previous retry round');
select extensions.is((select retry_due_at from public.practice_drafts where id='16900000-0000-4000-8000-000000000002'),'2026-11-02T10:00:00Z'::timestamptz,'unanswered new round inherits its original second-try due time');
select extensions.is((select candidate_key from public.practice_drafts where id='16900000-0000-4000-8000-000000000002'),(select candidate_key from public.practice_drafts where id=:'draft'),'server overwrites forged candidate key and preserves mark identity across artifacts');
select extensions.is((public.create_practice_round(:'user_a',pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000092','请求重放不得另开第三题。'),'16f00000-0000-4000-8000-000000000001')#>>'{draft,id}'),:'draft','open-reuse request receipt still replays the original task after a later round exists');
select extensions.is((public.get_practice_round_request(:'user_a',(select candidate_key from public.practice_drafts where id=:'draft'),'16f00000-0000-4000-8000-000000000001')->>'id'),:'draft','durable request lookup recovers a reused unanswered round');
select extensions.is(public.get_practice_round_request(:'user_b',(select candidate_key from public.practice_drafts where id=:'draft'),'16f00000-0000-4000-8000-000000000001'),null::jsonb,'request receipts do not cross owners');
insert into round_results values('round2_pass',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt('16900000-0000-4000-8000-000000000002','16b00000-0000-4000-8000-000000000003','这个安排太离谱了。',5,1,'2026-11-01T12:00:00Z')));
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000002')->>'status','promoted','round-two original independent success promotes');
select extensions.is((select entry_round from public.attempts where id='16b00000-0000-4000-8000-000000000003'),2,'canonical first evidence records entry_round two');
select extensions.is((select mastery_state from public.user_expressions where id=(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000002')#>>'{promotion,userExpressionId}')::uuid),'tried','round-two entry still starts as tried');
select extensions.is((public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000002')#>>'{promotion,nextDueAt}')::timestamptz,'2026-11-02T12:00:00Z'::timestamptz,'first review uses round-two submitted time plus 24h');
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000002')#>'{firstAnswer,naturalVersion}','null'::jsonb,'all-five natural version is suppressed durably');
select extensions.ok(public.create_practice_round(:'user_a',pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000093','晋升后不能另建练习草稿。'),'16f00000-0000-4000-8000-000000000093')?'promoted','already-promoted candidate returns its canonical destination');
-- A privileged stale writer cannot bypass the candidate-wide receipt fence.
insert into public.practice_drafts select (jsonb_populate_record(null::public.practice_drafts,pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000003','邻居说停车费突然涨了很多，问你什么想法。')||jsonb_build_object('round_number',3,'status','open','previous_draft_id','16900000-0000-4000-8000-000000000002'))).*;
insert into public.practice_draft_attempts select (jsonb_populate_record(null::public.practice_draft_attempts,pg_temp.round_attempt('16900000-0000-4000-8000-000000000003','16b00000-0000-4000-8000-000000000004','这也太离谱了吧。',5))).*;
select extensions.throws_ok(format('select * from public.promote_valid_practice_draft_attempt(%L,%L,%L,%L::timestamptz,1)',:'user_a','16b00000-0000-4000-8000-000000000004','太离谱了','2026-11-02T10:00:00Z'),'40001',null,'a different round cannot promote a candidate with an existing receipt');
select extensions.is((select count(*)::integer from private.practice_promotion_receipts where user_id=:'user_a' and candidate_key=(select candidate_key from public.practice_drafts where id=:'draft')),1,'same mark across rounds/artifact versions has one canonical promotion receipt');

-- A separate assisted candidate tests durable examples, server derivation,
-- removal/Undo and reactivation; its identity must remain stable across rounds.
insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
select '16800000-0000-4000-8000-000000000003',user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,jsonb_set(content,'{candidates,0,highlightKey}','"assisted-round-mark"'::jsonb),prompt_version,model,repeat('4',64),created_at from public.generated_artifacts where id=:'artifact';
insert into public.practice_drafts select (jsonb_populate_record(null::public.practice_drafts,pg_temp.round_payload(:'draft','16900000-0000-4000-8000-000000000004','朋友说外出办事等了很久，问你如何回应。','16800000-0000-4000-8000-000000000003')||jsonb_build_object('status','open'))).*;
select extensions.is(public.change_practice_round(:'user_b','16900000-0000-4000-8000-000000000004','examples'),null::jsonb,'wrong owner cannot open examples');
insert into round_results values('examples',public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000004','examples'));
create temp table example_stamp as select examples_opened_at from public.practice_drafts where id='16900000-0000-4000-8000-000000000004';
select public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000004','examples');
select extensions.is((select examples_opened_at from public.practice_drafts where id='16900000-0000-4000-8000-000000000004'),(select examples_opened_at from example_stamp),'repeated example disclosure preserves the first durable timestamp');
insert into round_results values('assisted',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt('16900000-0000-4000-8000-000000000004','16b00000-0000-4000-8000-000000000005','这也太离谱了吧。',5)));
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')#>>'{firstAnswer,evaluation,assistanceLevel}','model_answer','server marker overrides a spoofed none assistance value');
select extensions.is((public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')#>>'{firstAnswer,evaluation,independentUse}')::boolean,false,'assisted perfect answer is not independent evidence');
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')->>'status','retry_scheduled','assisted passing original follows the second-try path');
insert into round_results values('remove',public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000004','remove'));
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')->>'status','removed','remove immediately excludes the candidate');
select extensions.is((select (value->>'undoUntil')::timestamptz from round_results where name='remove')-(select removed_at from public.practice_drafts where id='16900000-0000-4000-8000-000000000004'),interval '5 seconds','Undo expiry is exactly five seconds after server removal');
select public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000004','restore');
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')->>'status','retry_scheduled','timely Undo restores the previous lifecycle status');
select extensions.is((public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')->>'retryDueAt')::timestamptz,'2026-11-02T10:00:00Z'::timestamptz,'remove and Undo do not alter retry scheduling');
select public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000004','remove');
update public.practice_drafts set removed_at=clock_timestamp()-interval '6 seconds' where id='16900000-0000-4000-8000-000000000004';
select extensions.throws_ok(format('select public.change_practice_round(%L,%L,%L)',:'user_a','16900000-0000-4000-8000-000000000004','restore'),'40001',null,'expired Undo is rejected by server clock');
select extensions.is(public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000004')->>'status','removed','failed expired Undo preserves removal');
insert into round_results values('reactivated',public.create_practice_round(:'user_a',pg_temp.round_payload('16900000-0000-4000-8000-000000000004','16900000-0000-4000-8000-000000000005','朋友听说车票很贵，问你会怎么说。'),'16f00000-0000-4000-8000-000000000005'));
select extensions.is((select (value#>>'{draft,round_number}')::integer from round_results where name='reactivated'),2,'practicing a removed candidate opens a fresh round');
select extensions.is((public.get_practice_round_state(:'user_a','16900000-0000-4000-8000-000000000005')->>'examplesOpened')::boolean,false,'fresh round has its own independent examples marker');

-- Opening examples after a recorded independent answer never rewrites it.
select public.change_practice_round(:'user_a','16900000-0000-4000-8000-000000000002','examples');
insert into round_results values('promoted_replay',public.record_practice_round_attempt(:'user_a',pg_temp.round_attempt('16900000-0000-4000-8000-000000000002',gen_random_uuid(),'这个安排太离谱了。',5)));
select extensions.is((select value#>>'{attempt,assistance_level}' from round_results where name='promoted_replay'),'none','later example disclosure cannot change recorded original assistance on replay');
select extensions.is((select (value#>>'{attempt,independent_use}')::boolean from round_results where name='promoted_replay'),true,'later examples do not revoke existing independent evidence');

-- Group-2 due scope: examples persistence and server-derived assistance only.
-- The task is a direct test fixture; no group-4 generation/revision is added.
create temp table due_fixture as
select r.id review_id,r.user_expression_id,r.due_at,
 jsonb_build_object('reviewTaskId',r.id,'practiceTaskId','16e00000-0000-4000-8000-000000000001',
  'responseChinese','这个报价太离谱了。','assistanceLevel','none','passed',true,'independentUse',true,
  'accuracyScore',5,'accuracyFeedbackEnglish','Correct meaning.','naturalnessScore',5,'naturalnessFeedbackEnglish','Natural wording.',
  'contextualFitScore',5,'contextualFitFeedbackEnglish','Fits the act.','completedAt','2026-11-02T13:00:00Z') input
from public.review_tasks r join public.practice_drafts d on d.future_user_expression_id=r.user_expression_id
where d.id='16900000-0000-4000-8000-000000000002' and r.status='pending';
insert into public.practice_tasks(id,user_id,user_expression_id,review_task_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,created_at)
select '16e00000-0000-4000-8000-000000000001',:'user_a',user_expression_id,review_id,'due_practice','en','zh-CN','太离谱了',
 '同事说服务费涨了三倍，问你怎么看。','Reply naturally.','Use the target expression.',due_at,due_at from due_fixture;
select extensions.is(public.get_due_practice_assistance(:'user_a',(select review_id from due_fixture)),'none','due review starts without examples assistance');
select extensions.is(public.open_due_practice_examples(:'user_b',(select review_id from due_fixture)),null::jsonb,'wrong owner cannot open due examples');
select public.open_due_practice_examples(:'user_a',(select review_id from due_fixture));
select extensions.is(public.get_due_practice_assistance(:'user_a',(select review_id from due_fixture)),'model_answer','due examples marker survives through server recovery');
insert into round_results values('due_completion',public.complete_due_practice_with_examples(:'user_a',(select input from due_fixture)));
select extensions.is((select value#>>'{completion,new_state}' from round_results where name='due_completion'),'tried','assisted passing due review does not advance mastery');
select extensions.is((select (value#>>'{completion,interval_days}')::integer from round_results where name='due_completion'),1,'assisted due review schedules the next attempt in one day');
select extensions.is((select (value#>>'{completion,next_due_at}')::timestamptz from round_results where name='due_completion'),'2026-11-03T13:00:00Z'::timestamptz,'assisted due schedule uses its completion time plus 24h');
select extensions.ok((select a.assistance_level='model_answer' and not a.independent_use from public.attempts a join round_results r on a.id=(r.value#>>'{completion,attempt_id}')::uuid where r.name='due_completion'),'due server writer ignores spoofed client none/independent evidence');
insert into round_results values('due_replay',public.complete_due_practice_with_examples(:'user_a',(select input||'{"assistanceLevel":"hint"}'::jsonb from due_fixture)));
select extensions.is((select (value#>>'{completion,created}')::boolean from round_results where name='due_replay'),false,'due replay remains idempotent even when the client changes its assistance claim');
select extensions.is((select value#>>'{completion,attempt_id}' from round_results where name='due_replay'),(select value#>>'{completion,attempt_id}' from round_results where name='due_completion'),'due replay keeps the original official evidence identity');

-- Owner RLS and RPC grants are exercised with actual database roles.
set local role authenticated;
select set_config('request.jwt.claim.sub',:'user_a',true);
select extensions.is((select count(*)::integer from public.practice_drafts where id='16900000-0000-4000-8000-000000000002'),1,'owner can read durable round state through row RLS');
select set_config('request.jwt.claim.sub',:'user_b',true);
select extensions.is((select count(*)::integer from public.practice_drafts),0,'another owner cannot read lifecycle fixtures');
select extensions.is((select count(*)::integer from public.practice_draft_attempts),0,'another owner cannot read first/revision answer evidence');
select extensions.throws_ok(format('select public.change_practice_round(%L,%L,%L)',:'user_b',:'draft','remove'),'42501',null,'browser role cannot call server-only lifecycle writer');
select extensions.throws_ok(format('select public.record_practice_round_attempt(%L,%L::jsonb)',:'user_b','{}'),'42501',null,'browser role cannot write scored evidence through the RPC');
reset role;
select extensions.ok((select relrowsecurity from pg_class where oid='private.practice_round_requests'::regclass),'round request receipt table enables RLS');
select extensions.ok(not has_table_privilege('service_role','private.practice_round_requests','SELECT') and not has_table_privilege('authenticated','private.practice_round_requests','SELECT'),'request receipts stay private even from direct server reads');
select * from extensions.finish();
rollback;
