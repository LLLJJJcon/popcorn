begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
select extensions.is(private.utf16_length(''),0,'empty prefix has zero UTF16 units');
\set owner '0e000000-0000-4000-8000-00000000a001'
\set other '0e000000-0000-4000-8000-00000000b002'
\set source '1e000000-0000-4000-8000-000000000001'
\set snapshot '2e000000-0000-4000-8000-000000000001'
\set moment '3e000000-0000-4000-8000-000000000001'
\set selection '3e000000-0000-4000-8000-000000000002'
\set row_save '3e000000-0000-4000-8000-000000000003'
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000',:'owner','authenticated','authenticated','highlights-a@popcorn.test',crypt('password',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000',:'other','authenticated','authenticated','highlights-b@popcorn.test',crypt('password',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.profiles(user_id) values(:'owner'),(:'other') on conflict do nothing;
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(:'source',:'owner','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ');
insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
 values(:'snapshot',:'owner',:'source','字幕测试','频道','https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',100,'测试','zh-CN',repeat('e',64),now());
insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language) values
 (:'owner',:'snapshot','h0',0,'😀咖啡高得要命。',0,3,'zh-CN'),
 (:'owner',:'snapshot','h1',1,'今天又涨价了。',5,8,'zh-CN'),
 (:'owner',:'snapshot','h2',2,'以后自己做吧。',10,13,'zh-CN'),
 (:'owner',:'snapshot','h3',3,'这样比较省钱。',15,18,'zh-CN');
insert into public.saved_items(id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload) values
 (:'moment',:'owner',:'source','4e000000-0000-4000-8000-000000000001','dQw4w9WgXcQ','player_moment','saved',now(),4,'{"capturedSecond":4}'),
 (:'selection',:'owner',:'source','4e000000-0000-4000-8000-000000000002','dQw4w9WgXcQ','subtitle_selection','saved',now(),0,'{"originalChinese":"高得要命。\n今天","segmentIds":["h0","h1"],"startSeconds":0,"endSeconds":8,"startOffset":4,"endOffset":12,"contextBefore":[],"contextAfter":[]}'),
 (:'row_save',:'owner',:'source','4e000000-0000-4000-8000-000000000003','dQw4w9WgXcQ','subtitle_row','saved',now(),0,'{"originalChinese":"😀咖啡高得要命。","segmentId":"h0","startSeconds":0,"endSeconds":3,"contextBefore":[],"contextAfter":[]}'),
 ('3e000000-0000-4000-8000-000000000006',:'owner',:'source','4e000000-0000-4000-8000-000000000006','dQw4w9WgXcQ','ai_explanation','saved',now(),5,'{"selectedChinese":"今天","englishExplanation":"Today.","segmentIds":["h1"],"startSeconds":5,"endSeconds":8,"contextBefore":[],"contextAfter":[]}');
select extensions.lives_ok(format('update public.saved_items set snapshot_id=%L,status=''ready'' where user_id=%L',:'snapshot',:'owner'),'resolving ready saves atomically persists targets and seeds user marks');
select extensions.ok((select start_offset=0 and end_offset=2 and text='今天' from public.saved_item_highlights where saved_item_id='3e000000-0000-4000-8000-000000000006'),'explanation at line start seeds the exact user mark without a model');
select extensions.is((select payload->>'resolvedSegmentId' from public.saved_items where id=:'moment'),'h0','gap moment resolves to preceding line');
select extensions.is((select payload->>'originalChinese' from public.saved_items where id=:'moment'),'😀咖啡高得要命。','moment target text is persisted');
select extensions.is((select jsonb_array_length(payload->'contextAfter') from public.saved_items where id=:'moment'),2,'resolved payload has at most two after-lines');
select extensions.is((select highlight_status from public.saved_items where id=:'moment'),'unavailable','missing gateway falls back without blocking saved text');
select extensions.is((select start_seconds from public.saved_items where id=:'moment'),4::numeric,'capture index remains compatible while resolved time is in payload');
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id=:'selection'),1,'saved selection creates exactly one user mark without a model');
select extensions.ok((select start_segment_id='h0' and start_offset=4 and end_segment_id='h1' and end_offset=2 and text=E'高得要命。\n今天' from public.saved_item_highlights where saved_item_id=:'selection'),'joined UTF16 selection offsets become per-line offsets');
update public.saved_items set status='ready' where id=:'selection';
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id=:'selection'),1,'ready replays never duplicate seeded marks');
set local role service_role;
select extensions.ok(public.mutate_saved_item_highlight(:'owner',:'row_save','add',null,'h0',4,'h0',8,'高得要命','2026-11-01 00:01:00+00'),'mark add matches persisted UTF16 range');
select extensions.ok(not public.mutate_saved_item_highlight(:'other',:'row_save','add',null,'h0',4,'h0',8,'高得要命','2026-11-01 00:01:00+00'),'foreign owner cannot mutate saved marks');
select extensions.ok(public.mutate_saved_item_highlight(:'owner',:'row_save','add',null,'h0',5,'h0',8,'得要命','2026-11-01 00:01:01+00'),'new overlapping mark replaces prior mark atomically');
reset role;
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id=:'row_save' and status='active'),1,'only replacement is active');
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id=:'row_save' and status='removed'),1,'replaced mark is retained as removed');
select id as active_mark from public.saved_item_highlights where saved_item_id=:'row_save' and status='active' \gset
set local role service_role;
select extensions.ok(public.mutate_saved_item_highlight(:'owner',:'row_save','remove',:'active_mark',null,null,null,null,null,'2026-11-01 00:01:02+00'),'remove soft-deletes mark');
select extensions.ok(public.mutate_saved_item_highlight(:'owner',:'row_save','restore',:'active_mark',null,null,null,null,null,'2026-11-01 00:01:05+00'),'undo restores within five seconds');
select extensions.ok(public.mutate_saved_item_highlight(:'owner',:'row_save','remove',:'active_mark',null,null,null,null,null,'2026-11-01 00:01:06+00'),'mark can be removed again');
select extensions.ok(not public.mutate_saved_item_highlight(:'owner',:'row_save','restore',:'active_mark',null,null,null,null,null,'2026-11-01 00:01:12+00'),'expired undo is rejected');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'other',true);
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id=:'row_save'),0,'RLS hides another user marks');
select extensions.ok(not has_function_privilege('authenticated','public.mutate_saved_item_highlight(uuid,uuid,text,uuid,text,integer,text,integer,text,timestamptz)','execute'),'mutation RPC is service-only');
reset role;

-- A gateway-enabled ready transition queues exactly one pinned suggestion job.
-- Legacy player moments have no persisted resolved segment. Resolve at mutation time without backfill.
insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values('3e000000-0000-4000-8000-000000000007',:'owner',:'source',:'snapshot','4e000000-0000-4000-8000-000000000007','dQw4w9WgXcQ','player_moment','ready',now(),4,'{"capturedSecond":4}');
set local role service_role;
select extensions.throws_ok(format('select public.mutate_saved_item_highlight(%L,''3e000000-0000-4000-8000-000000000007'',''add'',null,''h1'',0,''h1'',2,''今天'',''2026-11-01 00:01:00+00'')',:'owner'),'P0001','Selection must stay in saved target lines','legacy player moment cannot mark a context line via null target authorization');
select extensions.ok(public.mutate_saved_item_highlight(:'owner','3e000000-0000-4000-8000-000000000007','add',null,'h0',4,'h0',8,'高得要命','2026-11-01 00:01:00+00'),'legacy ready player moment resolves its target for marking');
reset role;
select id as legacy_moment_mark from public.saved_item_highlights where saved_item_id='3e000000-0000-4000-8000-000000000007' and status='active' and text='高得要命' \gset
set local role service_role;
select extensions.ok(public.mutate_saved_item_highlight(:'owner','3e000000-0000-4000-8000-000000000007','remove',:'legacy_moment_mark',null,null,null,null,null,'2026-11-01 00:01:01+00'),'legacy player mark can be removed');
select extensions.ok(public.mutate_saved_item_highlight(:'owner','3e000000-0000-4000-8000-000000000007','restore',:'legacy_moment_mark',null,null,null,null,null,'2026-11-01 00:01:03+00'),'legacy player mark resolves the same target on undo');
reset role;
select extensions.is((select payload from public.saved_items where id='3e000000-0000-4000-8000-000000000007'),'{"capturedSecond":4}'::jsonb,'legacy mark and restore do not backfill saved payload');

-- A genuinely absent target and NULL supplied IDs must fail closed.
insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
 select '2e000000-0000-4000-8000-000000000002',user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,repeat('f',64),captured_at from public.video_snapshots where id=:'snapshot';
insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values('3e000000-0000-4000-8000-000000000008',:'owner',:'source','2e000000-0000-4000-8000-000000000002','4e000000-0000-4000-8000-000000000008','dQw4w9WgXcQ','player_moment','ready',now(),4,'{"capturedSecond":4}');
set local role service_role;
select extensions.throws_ok(format('select public.mutate_saved_item_highlight(%L,''3e000000-0000-4000-8000-000000000008'',''add'',null,''h0'',4,''h0'',8,''高得要命'',''2026-11-01 00:01:00+00'')',:'owner'),'P0001','Selection must stay in saved target lines','legacy moment with no snapshot target fails closed');
select extensions.throws_ok(format('select public.mutate_saved_item_highlight(%L,''3e000000-0000-4000-8000-000000000007'',''add'',null,null,4,''h0'',8,''高得要命'',''2026-11-01 00:01:00+00'')',:'owner'),'P0001','Selection must stay in saved target lines','NULL supplied target ID cannot bypass membership validation');
reset role;


insert into public.model_gateway_origins(id,slug,display_name,canonical_origin,base_path,adapter_kind,state)
 values('8e000000-0000-4000-8000-000000000001','highlights-test','Highlights test','https://highlights.example.com','/v1','openai-compatible','active');
set local role service_role;
select * from public.create_user_model_gateway_config(:'owner','8e100000-0000-4000-8000-000000000001','8e000000-0000-4000-8000-000000000001','Highlights','provider/test','test-secret','2026-11-01 00:00:00+00');
select public.activate_user_model_gateway_config(:'owner','8e100000-0000-4000-8000-000000000001','https://highlights.example.com','model-egress-v1','2026-11-01 00:00:01+00');
reset role;
-- Old nullable statuses are interpreted as unavailable only on explicit retry.
update public.saved_items set highlight_status=null where id=:'row_save';
select config_id,revision,config_fingerprint from public.resolve_active_user_model_gateway_pin(:'owner') \gset legacy_pin_
set local role service_role;
select extensions.ok(public.register_saved_item_highlight_suggestion(:'owner',:'row_save',repeat('9',64),jsonb_build_object('kind','highlight_saved_item','savedItemId',:'row_save','snapshotId',:'snapshot','gatewayConfigId',:'legacy_pin_config_id','gatewayRevision',:legacy_pin_revision,'gatewayFingerprint',:'legacy_pin_config_fingerprint'),:'legacy_pin_config_id',:legacy_pin_revision,:'legacy_pin_config_fingerprint','2026-11-01 00:00:05+00'),'explicit suggestion retries legacy null status without backfilling saves');
select extensions.ok(not public.register_saved_item_highlight_suggestion(:'owner',:'row_save',repeat('8',64),jsonb_build_object('kind','highlight_saved_item','savedItemId',:'row_save','snapshotId',:'snapshot','gatewayConfigId',:'legacy_pin_config_id','gatewayRevision',:legacy_pin_revision,'gatewayFingerprint',:'legacy_pin_config_fingerprint'),:'legacy_pin_config_id',:legacy_pin_revision,:'legacy_pin_config_fingerprint','2026-11-01 00:00:05+00'),'repeated retry clicks cannot queue concurrent suggestions');
reset role;
insert into public.saved_items(id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values('3e000000-0000-4000-8000-000000000004',:'owner',:'source','4e000000-0000-4000-8000-000000000004','dQw4w9WgXcQ','subtitle_row','saved',now(),0,'{"originalChinese":"😀咖啡高得要命。","segmentId":"h0","startSeconds":0,"endSeconds":3,"contextBefore":[],"contextAfter":[]}');
update public.saved_items set snapshot_id=:'snapshot',status='ready' where id='3e000000-0000-4000-8000-000000000004';
select extensions.is((select highlight_status from public.saved_items where id='3e000000-0000-4000-8000-000000000004'),'pending','gateway-enabled save becomes pending automatically');
select extensions.is((select count(*)::integer from public.knowledge_jobs where user_id=:'owner' and saved_item_id='3e000000-0000-4000-8000-000000000004' and job_type='highlight_saved_item'),1,'exactly one suggestion job is registered');
select id as suggestion_job from public.knowledge_jobs where user_id=:'owner' and saved_item_id='3e000000-0000-4000-8000-000000000004' and job_type='highlight_saved_item' \gset
update public.knowledge_jobs set status='leased',attempt_count=1,lease_expires_at='2026-11-01 01:00:00+00' where id=:'suggestion_job';
set local role service_role;
select extensions.ok(not public.complete_saved_item_highlights(:'owner',:'suggestion_job','2026-11-01 01:01:00+00',1,'[]',false,'2026-11-01 00:01:00+00'),'stale lease cannot publish suggestions');
select extensions.ok(public.mutate_saved_item_highlight(:'owner','3e000000-0000-4000-8000-000000000004','add',null,'h0',4,'h0',8,'高得要命','2026-11-01 00:01:00+00'),'user may mark while suggestions are pending');
reset role;
select id as pending_user_mark from public.saved_item_highlights where saved_item_id='3e000000-0000-4000-8000-000000000004' and status='active' \gset
set local role service_role;
select extensions.ok(public.mutate_saved_item_highlight(:'owner','3e000000-0000-4000-8000-000000000004','remove',:'pending_user_mark',null,null,null,null,null,'2026-11-01 00:01:01+00'),'pending user mark can be removed');
select extensions.ok(public.complete_saved_item_highlights(:'owner',:'suggestion_job','2026-11-01 01:00:00+00',1,'[{"startSegmentId":"h0","startOffset":4,"endSegmentId":"h0","endOffset":8,"text":"高得要命","reasonEn":"Express a strong complaint"}]',false,'2026-11-01 00:01:02+00'),'valid owned lease completes suggestion result');
reset role;
select extensions.is((select count(*)::integer from public.saved_item_highlights where saved_item_id='3e000000-0000-4000-8000-000000000004' and status='active'),0,'late suggestions cannot resurrect an explicitly removed mark');
select extensions.is((select highlight_status from public.saved_items where id='3e000000-0000-4000-8000-000000000004'),'ready','suggestion completion publishes ready state');


-- Removing an unpracticed bookmark fences late work without touching old cards.
insert into public.saved_items(id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
 values('3e000000-0000-4000-8000-000000000005',:'owner',:'source','4e000000-0000-4000-8000-000000000005','dQw4w9WgXcQ','subtitle_row','saved',now(),0,'{"originalChinese":"😀咖啡高得要命。","segmentId":"h0","startSeconds":0,"endSeconds":3,"contextBefore":[],"contextAfter":[]}');
update public.saved_items set snapshot_id=:'snapshot',status='ready' where id='3e000000-0000-4000-8000-000000000005';
select id as cancelled_job from public.knowledge_jobs where user_id=:'owner' and saved_item_id='3e000000-0000-4000-8000-000000000005' and job_type='highlight_saved_item' \gset
update public.knowledge_jobs set status='leased',attempt_count=1,lease_expires_at='2026-11-01 01:00:00+00' where id=:'cancelled_job';
update public.saved_items set removed_from_saved_at='2026-11-01 00:01:00+00' where id='3e000000-0000-4000-8000-000000000005';
set local role service_role;
select extensions.ok(public.complete_saved_item_highlights(:'owner',:'cancelled_job','2026-11-01 01:00:00+00',1,'[]',false,'2026-11-01 00:01:02+00'),'late result acknowledges a removed bookmark by cancelling its job');
reset role;
select extensions.is((select status from public.knowledge_jobs where id=:'cancelled_job'),'terminal_failed','removed bookmark leaves no leased suggestion job');
select extensions.is((select input from public.knowledge_job_internal where knowledge_job_id=:'cancelled_job'),'{}'::jsonb,'cancelled suggestion private input is cleared');
set local role service_role;
select extensions.lives_ok(format('select * from public.delete_video_source(%L,%L,''remove_unpracticed_source'',''2026-11-01 00:02:00+00'')',:'owner',:'source'),'source deletion cleans pinned suggestion jobs and cascades marks');
reset role;
select extensions.is((select count(*)::integer from public.saved_item_highlights where user_id=:'owner'),0,'source deletion leaves no orphan highlights');
select extensions.is((select count(*)::integer from public.knowledge_jobs where user_id=:'owner'),0,'source deletion leaves no orphan suggestion jobs');

select * from extensions.finish();
rollback;
