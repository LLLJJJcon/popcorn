begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','0f000000-0000-4000-8000-000000000001','authenticated','authenticated','marked-cards@popcorn.test',crypt('password',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.profiles(user_id) values ('0f000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url)
values ('0f100000-0000-4000-8000-000000000001','0f000000-0000-4000-8000-000000000001','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ');
insert into public.saved_items(id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
values ('0f200000-0000-4000-8000-000000000001','0f000000-0000-4000-8000-000000000001','0f100000-0000-4000-8000-000000000001','0f300000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row','ready','2026-11-01T00:00:00Z',10,'{"segmentId":"seg-card","originalChinese":"价格高得要命","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}');
insert into public.knowledge_jobs(id,user_id,video_source_id,saved_item_id,job_type,status,dedupe_key,attempt_count,lease_expires_at,created_at,updated_at)
select ('0f400000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'0f000000-0000-4000-8000-000000000001','0f100000-0000-4000-8000-000000000001','0f200000-0000-4000-8000-000000000001','analyze_saved_item','leased',repeat(n::text,64),1,'2026-11-01T00:05:00Z','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z' from generate_series(1,3) n;
insert into public.knowledge_job_internal(knowledge_job_id,user_id,input)
select id,user_id,'{}' from public.knowledge_jobs where video_source_id='0f100000-0000-4000-8000-000000000001';
create temporary table card_receipts(n integer,id uuid);
create temporary table card_inputs(n integer,content jsonb);
insert into card_inputs values
(1,'{"candidates":[{"expression":"高得要命","highlightKey":"key-1","meaningHere":"Ridiculously high.","englishMeaning":"first-card"}],"highlightStates":[{"highlightId":"0f500000-0000-4000-8000-000000000001","text":"高得要命","status":"ready"}]}'),
(2,'{"candidates":[{"expression":"说白了","highlightKey":"key-2","meaningHere":"Put simply.","englishMeaning":"second-card"}],"highlightStates":[{"highlightId":"0f500000-0000-4000-8000-000000000002","text":"说白了","status":"ready"}]}'),
(3,'{"candidates":[{"expression":"高得要命","highlightKey":"key-1","meaningHere":"Changed meaning.","englishMeaning":"replacement"}],"highlightStates":[{"highlightId":"0f500000-0000-4000-8000-000000000001","text":"高得要命","status":"ready"}]}');

-- These jobs all started at the same time and each read only its own missing
-- mark. Publishing must append to the current aggregate under the save lock.
insert into card_receipts select 1,public.complete_learning_artifact_job(
 '0f000000-0000-4000-8000-000000000001','0f400000-0000-4000-8000-000000000001','0f100000-0000-4000-8000-000000000001','analyze_saved_item','2026-11-01T00:05:00Z',1,'saved_item_analysis',(select content from card_inputs where n=1),'analyze-saved-item-v3','fixture/cards',repeat('1',64),'2026-11-01T00:00:00Z');
insert into card_receipts select 2,public.complete_learning_artifact_job(
 '0f000000-0000-4000-8000-000000000001','0f400000-0000-4000-8000-000000000002','0f100000-0000-4000-8000-000000000001','analyze_saved_item','2026-11-01T00:05:00Z',1,'saved_item_analysis',(select content from card_inputs where n=2),'analyze-saved-item-v3','fixture/cards',repeat('2',64),'2026-11-01T00:00:00Z');
insert into card_receipts select 3,public.complete_learning_artifact_job(
 '0f000000-0000-4000-8000-000000000001','0f400000-0000-4000-8000-000000000003','0f100000-0000-4000-8000-000000000001','analyze_saved_item','2026-11-01T00:05:00Z',1,'saved_item_analysis',(select content from card_inputs where n=3),'analyze-saved-item-v3','fixture/cards',repeat('3',64),'2026-11-01T00:00:00Z');

select extensions.is((select jsonb_array_length(content->'candidates') from public.generated_artifacts where id=(select id from card_receipts where n=2)),2,'independently generated cards append without losing an earlier result');
select extensions.is((select jsonb_array_length(content->'candidates') from public.generated_artifacts where id=(select id from card_receipts where n=3)),2,'same text and position never generates a duplicate card');
select extensions.is((select content->'candidates'->0->>'englishMeaning' from public.generated_artifacts where id=(select id from card_receipts where n=3)),'first-card','existing candidate content and index stay immutable');
select extensions.is((select jsonb_array_length(content->'candidates') from public.generated_artifacts where id=(select id from card_receipts where n=1)),1,'an older artifact remains unchanged for existing practice');
select extensions.ok((select later.created_at>earlier.created_at from public.generated_artifacts later,public.generated_artifacts earlier where later.id=(select id from card_receipts where n=2) and earlier.id=(select id from card_receipts where n=1)),'completion ordering is deterministic even with identical worker clocks');
select extensions.is((select jsonb_array_length(content->'highlightStates') from public.generated_artifacts where id=(select id from card_receipts where n=3)),2,'per-mark states merge without duplicating the same highlight');
select * from extensions.finish();
rollback;
