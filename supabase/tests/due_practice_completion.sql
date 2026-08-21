begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '0e000000-0000-4000-8000-00000000a001'
\set user_b '0e000000-0000-4000-8000-00000000b002'
\set source_a '0e100000-0000-4000-8000-000000000001'
\set source_b '0e100000-0000-4000-8000-000000000002'

select extensions.has_column('public','review_tasks','completed_at','review completion timestamp is explicit');
select extensions.has_column('public','review_tasks','completed_attempt_id','review completion binds its attempt');
select extensions.has_column('public','practice_tasks','review_task_id','due Practice task binds its review');
select extensions.has_column('public','practice_tasks','context_fingerprint','practice context has a durable fingerprint');
select extensions.has_table('private','due_practice_completion_receipts','private due-completion receipts exist');
select extensions.has_function(
  'public','complete_due_practice',array[
    'uuid','uuid','uuid','text','text','text','boolean','integer','text','integer','text',
    'integer','text','timestamp with time zone','text','text','uuid','integer','text'
  ],'atomic due Practice completion RPC exists'
);

select extensions.ok(
  has_function_privilege('service_role',
    'public.complete_due_practice(uuid,uuid,uuid,text,text,text,boolean,integer,text,integer,text,integer,text,timestamptz,text,text,uuid,integer,text)',
    'execute')
  and not has_function_privilege('authenticated',
    'public.complete_due_practice(uuid,uuid,uuid,text,text,text,boolean,integer,text,integer,text,integer,text,timestamptz,text,text,uuid,integer,text)',
    'execute'),
  'only service role can complete due Practice'
);
select extensions.ok(
  not has_table_privilege('service_role','private.due_practice_completion_receipts','select')
  and not has_table_privilege('authenticated','private.due_practice_completion_receipts','select'),
  'receipt rows are invisible outside the definer RPC'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'due-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'due-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.profiles(user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values
  (:'source_a',:'user_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'source_b',:'user_b','M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE');

insert into public.expression_senses(
  id,user_id,video_source_id,expression_text,normalized_expression_text,
  english_meaning,english_explanation,tone,communicative_function,register
) values
  ('0e200000-0000-4000-8000-000000000001',:'user_a',:'source_a','太离谱了','太离谱了','absurd','Reaction expression.','surprised','reaction','informal'),
  ('0e200000-0000-4000-8000-000000000002',:'user_a',:'source_a','没想到','没想到','unexpected','Marks surprise.','surprised','reaction','informal'),
  ('0e200000-0000-4000-8000-000000000003',:'user_a',:'source_a','挺有意思','挺有意思','interesting','Positive reaction.','positive','reaction','informal'),
  ('0e200000-0000-4000-8000-000000000004',:'user_a',:'source_a','说实话','说实话','honestly','Frames an opinion.','neutral','opinion','informal'),
  ('0e200000-0000-4000-8000-000000000005',:'user_a',:'source_a','别客气','别客气','you are welcome','Polite response.','warm','polite response','polite'),
  ('0e200000-0000-4000-8000-000000000006',:'user_b',:'source_b','太离谱了','太离谱了','absurd','Other owner.','surprised','reaction','informal'),
  ('0e200000-0000-4000-8000-000000000007',:'user_a',:'source_a','慢慢来','慢慢来','take your time','Reassuring response.','warm','reassurance','informal'),
  ('0e200000-0000-4000-8000-000000000008',:'user_a',:'source_a','别着急','别着急','do not worry','Reassuring response.','warm','reassurance','informal'),
  ('0e200000-0000-4000-8000-000000000009',:'user_a',:'source_a','太夸张了','太夸张了','too exaggerated','Strong reaction.','surprised','reaction','informal'),
  ('0e200000-0000-4000-8000-000000000010',:'user_a',:'source_a','没关系','没关系','it is okay','Warm response.','warm','reassurance','informal'),
  ('0e200000-0000-4000-8000-000000000011',:'user_a',:'source_a','不用担心','不用担心','do not worry','Reassuring response.','warm','reassurance','informal');
insert into public.user_expressions(id,user_id,expression_sense_id,mastery_state,created_at,updated_at) values
  ('0e300000-0000-4000-8000-000000000001',:'user_a','0e200000-0000-4000-8000-000000000001','tried','2026-08-16','2026-08-16'),
  ('0e300000-0000-4000-8000-000000000002',:'user_a','0e200000-0000-4000-8000-000000000002','tried','2026-08-16','2026-08-16'),
  ('0e300000-0000-4000-8000-000000000003',:'user_a','0e200000-0000-4000-8000-000000000003','reused','2026-08-16','2026-08-18'),
  ('0e300000-0000-4000-8000-000000000004',:'user_a','0e200000-0000-4000-8000-000000000004','reused','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000005',:'user_a','0e200000-0000-4000-8000-000000000005','owned','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000006',:'user_b','0e200000-0000-4000-8000-000000000006','owned','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000007',:'user_a','0e200000-0000-4000-8000-000000000007','owned','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000008',:'user_a','0e200000-0000-4000-8000-000000000008','tried','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000009',:'user_a','0e200000-0000-4000-8000-000000000009','tried','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000010',:'user_a','0e200000-0000-4000-8000-000000000010','owned','2026-08-16','2026-08-20'),
  ('0e300000-0000-4000-8000-000000000011',:'user_a','0e200000-0000-4000-8000-000000000011','owned','2026-08-16','2026-08-20');

-- Historical independent due evidence for ownership threshold fixtures.
insert into public.review_tasks(
  id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes
) values
  ('0e400000-0000-4000-8000-000000000030',:'user_a','0e300000-0000-4000-8000-000000000003','tried','pending','2026-08-18 00:00+00',1,0),
  ('0e400000-0000-4000-8000-000000000040',:'user_a','0e300000-0000-4000-8000-000000000004','tried','pending','2026-08-20 00:00+00',1,0);
insert into public.practice_tasks(
  id,user_id,user_expression_id,review_task_id,kind,native_language,target_language,
  target_expression,prompt_chinese,instructions_english,goal_english,due_at,created_at
) values
  ('0e500000-0000-4000-8000-000000000030',:'user_a','0e300000-0000-4000-8000-000000000003','0e400000-0000-4000-8000-000000000030','due_practice','en','zh-CN','挺有意思','朋友分享一个新发现，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-18 00:00+00','2026-08-18 23:30+00'),
  ('0e500000-0000-4000-8000-000000000040',:'user_a','0e300000-0000-4000-8000-000000000004','0e400000-0000-4000-8000-000000000040','due_practice','en','zh-CN','说实话','同事问你对一个方案的看法，你会怎么说？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 00:30+00');
insert into public.attempts(
  id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
  accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
  contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at
) values
  ('0e600000-0000-4000-8000-000000000030',:'user_a','0e500000-0000-4000-8000-000000000030','0e300000-0000-4000-8000-000000000003','这个发现挺有意思。',true,5,'Accurate.',5,'Natural.',5,'Fits.',true,'none','2026-08-18 23:30+00'),
  ('0e600000-0000-4000-8000-000000000040',:'user_a','0e500000-0000-4000-8000-000000000040','0e300000-0000-4000-8000-000000000004','说实话，我不太同意。',true,5,'Accurate.',5,'Natural.',5,'Fits.',true,'none','2026-08-20 00:30+00');
insert into public.mastery_events(
  id,user_id,user_expression_id,attempt_id,prior_state,new_state,evidence_kind,occurred_at
) values
  ('0e700000-0000-4000-8000-000000000030',:'user_a','0e300000-0000-4000-8000-000000000003','0e600000-0000-4000-8000-000000000030','tried','reused','successful_independent_transfer','2026-08-18 23:30+00'),
  ('0e700000-0000-4000-8000-000000000040',:'user_a','0e300000-0000-4000-8000-000000000004','0e600000-0000-4000-8000-000000000040','tried','reused','successful_independent_transfer','2026-08-20 00:30+00');
update public.review_tasks set status='completed',completed_attempt_id='0e600000-0000-4000-8000-000000000030',completed_at='2026-08-18 23:30+00',updated_at='2026-08-18 23:30+00' where id='0e400000-0000-4000-8000-000000000030';
update public.review_tasks set status='completed',completed_attempt_id='0e600000-0000-4000-8000-000000000040',completed_at='2026-08-20 00:30+00',updated_at='2026-08-20 00:30+00' where id='0e400000-0000-4000-8000-000000000040';

insert into public.review_tasks(
  id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes
) values
  ('0e400000-0000-4000-8000-000000000001',:'user_a','0e300000-0000-4000-8000-000000000001','tried','pending','2026-08-20 00:00+00',1,0),
  ('0e400000-0000-4000-8000-000000000002',:'user_a','0e300000-0000-4000-8000-000000000002','tried','pending','2026-08-20 00:00+00',1,0),
  ('0e400000-0000-4000-8000-000000000003',:'user_a','0e300000-0000-4000-8000-000000000003','reused','pending','2026-08-20 00:00+00',7,1),
  ('0e400000-0000-4000-8000-000000000004',:'user_a','0e300000-0000-4000-8000-000000000004','reused','pending','2026-08-20 00:00+00',7,1),
  ('0e400000-0000-4000-8000-000000000005',:'user_a','0e300000-0000-4000-8000-000000000005','owned','pending','2026-08-20 00:00+00',30,3),
  ('0e400000-0000-4000-8000-000000000007',:'user_a','0e300000-0000-4000-8000-000000000007','owned','pending','2026-08-20 00:00+00',30,3),
  ('0e400000-0000-4000-8000-000000000008',:'user_a','0e300000-0000-4000-8000-000000000008','tried','pending','2026-08-20 00:00+00',1,0),
  ('0e400000-0000-4000-8000-000000000009',:'user_a','0e300000-0000-4000-8000-000000000009','tried','pending','2026-10-31 00:00-04',1,0),
  ('0e400000-0000-4000-8000-000000000010',:'user_a','0e300000-0000-4000-8000-000000000010','owned','pending','2026-10-31 00:00-04',30,3),
  ('0e400000-0000-4000-8000-000000000011',:'user_a','0e300000-0000-4000-8000-000000000011','owned','pending','2026-10-31 00:00-04',30,3);
insert into public.practice_tasks(
  id,user_id,user_expression_id,review_task_id,kind,native_language,target_language,
  target_expression,prompt_chinese,instructions_english,goal_english,due_at,created_at
) values
  ('0e500000-0000-4000-8000-000000000001',:'user_a','0e300000-0000-4000-8000-000000000001','0e400000-0000-4000-8000-000000000001','due_practice','en','zh-CN','太离谱了','朋友说票价突然翻了三倍，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000002',:'user_a','0e300000-0000-4000-8000-000000000002','0e400000-0000-4000-8000-000000000002','due_practice','en','zh-CN','没想到','朋友告诉你一个意外消息，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000003',:'user_a','0e300000-0000-4000-8000-000000000003','0e400000-0000-4000-8000-000000000003','due_practice','en','zh-CN','挺有意思','同学提出一个新的学习方法，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000004',:'user_a','0e300000-0000-4000-8000-000000000004','0e400000-0000-4000-8000-000000000004','due_practice','en','zh-CN','说实话','朋友问你对一部电影的看法，你会怎么说？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000005',:'user_a','0e300000-0000-4000-8000-000000000005','0e400000-0000-4000-8000-000000000005','due_practice','en','zh-CN','别客气','朋友感谢你的帮助，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000007',:'user_a','0e300000-0000-4000-8000-000000000007','0e400000-0000-4000-8000-000000000007','due_practice','en','zh-CN','慢慢来','朋友因为进度慢而着急，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000008',:'user_a','0e300000-0000-4000-8000-000000000008',null,'due_practice','en','zh-CN','别着急','朋友担心迟到，你会怎么安慰？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00','2026-08-20 01:00+00'),
  ('0e500000-0000-4000-8000-000000000009',:'user_a','0e300000-0000-4000-8000-000000000009','0e400000-0000-4000-8000-000000000009','due_practice','en','zh-CN','太夸张了','朋友说商品价格涨了十倍，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-10-31 00:00-04','2026-10-31 01:00-04'),
  ('0e500000-0000-4000-8000-000000000010',:'user_a','0e300000-0000-4000-8000-000000000010','0e400000-0000-4000-8000-000000000010','due_practice','en','zh-CN','没关系','朋友为一个小错误道歉，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-10-31 00:00-04','2026-10-31 01:00-04'),
  ('0e500000-0000-4000-8000-000000000011',:'user_a','0e300000-0000-4000-8000-000000000011','0e400000-0000-4000-8000-000000000011','due_practice','en','zh-CN','不用担心','朋友担心明天的安排，你会怎么安慰？','Reply in Mandarin.','Use the expression naturally.','2026-10-31 00:00-04','2026-10-31 01:00-04');

select extensions.throws_ok(
  $$insert into public.practice_tasks(user_id,user_expression_id,review_task_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at)
    values('0e000000-0000-4000-8000-00000000a001','0e300000-0000-4000-8000-000000000003','0e400000-0000-4000-8000-000000000003','due_practice','en','zh-CN','挺有意思','同学提出一个新的学习方法，你会怎么回应？','Reply in Mandarin.','Use the expression naturally.','2026-08-20 00:00+00')$$,
  '23505',null,'the same expression context cannot create a second task'
);

set local role service_role;
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000008','0e500000-0000-4000-8000-000000000008',repeat('8',64),
    '别着急，我们还有时间。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:00+00',null,null,null,null,null)$$,
  '22023',null,'an unlinked legacy due task cannot complete a pending review'
);
reset role;
select extensions.is(
  (select r.status || '|' || u.mastery_state || '|' ||
      (select count(*) from public.attempts where practice_task_id='0e500000-0000-4000-8000-000000000008')::text || '|' ||
      (select count(*) from public.mastery_events where user_expression_id='0e300000-0000-4000-8000-000000000008')::text || '|' ||
      (select count(*) from private.due_practice_completion_receipts where review_task_id='0e400000-0000-4000-8000-000000000008')::text
    from public.review_tasks r join public.user_expressions u on u.id=r.user_expression_id
    where r.id='0e400000-0000-4000-8000-000000000008'),
  'pending|tried|0|0|0',
  'an unlinked task failure leaves review, mastery, attempt, event, and receipt state unchanged'
);
-- Baseline succeeds incorrectly, so restore the fixture before later independent assertions.
delete from private.due_practice_completion_receipts where review_task_id='0e400000-0000-4000-8000-000000000008';
delete from public.mastery_events where user_expression_id='0e300000-0000-4000-8000-000000000008';
delete from public.review_tasks where user_expression_id='0e300000-0000-4000-8000-000000000008'
  and id<>'0e400000-0000-4000-8000-000000000008';
update public.review_tasks set status='pending',completed_attempt_id=null,completed_at=null,updated_at='2026-08-20'
where id='0e400000-0000-4000-8000-000000000008';
delete from public.attempts where practice_task_id='0e500000-0000-4000-8000-000000000008';
update public.user_expressions set mastery_state='tried',updated_at='2026-08-20'
where id='0e300000-0000-4000-8000-000000000008';
set local role service_role;
create temp table tried_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000001','0e500000-0000-4000-8000-000000000001',repeat('a',64),
  '这个票价太离谱了。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:00+00',null,null,null,null,null
);
select extensions.results_eq(
  $$select prior_state,new_state,interval_days,next_due_at,created from tried_result$$,
  $$values('tried'::text,'reused'::text,7,'2026-08-27 12:00+00'::timestamptz,true)$$,
  'successful independent due evidence advances tried to reused and schedules seven days'
);
select extensions.results_eq(
  $$select a.independent_use,a.assistance_level,e.prior_state,e.new_state,e.evidence_kind,r.status,r.completed_at
    from tried_result x join public.attempts a on a.id=x.attempt_id
    join public.mastery_events e on e.id=x.mastery_event_id
    join public.review_tasks r on r.id=x.review_task_id$$,
  $$values(true,'none'::text,'tried'::text,'reused'::text,'successful_independent_transfer'::text,'completed'::text,'2026-08-20 12:00+00'::timestamptz)$$,
  'completion stores canonical attempt, evidence, and old-review completion atomically'
);
select extensions.results_eq(
  $$select attempt_id,mastery_event_id,next_review_task_id,created from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000001','0e500000-0000-4000-8000-000000000001',repeat('a',64),
    '这个票价太离谱了。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:00+00',null,null,null,null,null)$$,
  $$select attempt_id,mastery_event_id,next_review_task_id,false from tried_result$$,
  'exact replay returns the same graph without new rows'
);
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000001','0e500000-0000-4000-8000-000000000001',repeat('b',64),
    '这个票价太离谱了。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:00+00',null,null,null,null,null)$$,
  '40001',null,'a different request key cannot complete an already completed review'
);
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000001','0e500000-0000-4000-8000-000000000001',repeat('a',64),
    '同一个键却换了回答。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:00+00',null,null,null,null,null)$$,
  '40001',null,'the same request key with different payload is not an exact replay'
);

select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000002','0e500000-0000-4000-8000-000000000001',repeat('c',64),
    '我没想到。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:10+00',null,null,null,null,null)$$,
  '22023',null,'a task from another review cannot complete the pending review'
);
update public.review_tasks set due_at='2026-08-21 00:00+00' where id='0e400000-0000-4000-8000-000000000002';
update public.practice_tasks set due_at='2026-08-21 00:00+00' where id='0e500000-0000-4000-8000-000000000002';
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000002','0e500000-0000-4000-8000-000000000002',repeat('c',64),
    '我没想到。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:10+00',null,null,null,null,null)$$,
  '40001',null,'a future review cannot be completed early'
);
update public.review_tasks set due_at='2026-08-20 00:00+00',status='cancelled' where id='0e400000-0000-4000-8000-000000000002';
update public.practice_tasks set due_at='2026-08-20 00:00+00' where id='0e500000-0000-4000-8000-000000000002';
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000002','0e500000-0000-4000-8000-000000000002',repeat('c',64),
    '我没想到。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:10+00',null,null,null,null,null)$$,
  '40001',null,'a cancelled review cannot be completed'
);
update public.review_tasks set status='pending' where id='0e400000-0000-4000-8000-000000000002';
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000002','0e500000-0000-4000-8000-000000000002',repeat('c',64),
    '我没想到。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:10+00','evaluate-v1',null,null,null,null)$$,
  '23514',null,'partial evaluation provenance cannot leave a staged completion'
);
select extensions.is(
  (select status || '|' || (select count(*) from public.attempts where practice_task_id='0e500000-0000-4000-8000-000000000002')::text from public.review_tasks where id='0e400000-0000-4000-8000-000000000002'),
  'pending|0',
  'failed validation rolls back the attempt and review mutation'
);

create temp table failed_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000002','0e500000-0000-4000-8000-000000000002',repeat('c',64),
  '我不知道。','model_answer',true,4,'Mostly accurate.',4,'Understandable.',3,'Needs context.','2026-08-20 12:10+00',null,null,null,null,null
);
select extensions.results_eq(
  $$select prior_state,new_state,interval_days,next_due_at from failed_result$$,
  $$values('tried'::text,'tried'::text,1,'2026-08-21 12:10+00'::timestamptz)$$,
  'assisted evidence does not advance mastery and schedules an early retry'
);
select extensions.is(
  (select independent_use from public.attempts where id=(select attempt_id from failed_result)),
  false,'independent use is derived by the RPC rather than accepted from callers'
);

create temp table owned_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000003','0e500000-0000-4000-8000-000000000003',repeat('d',64),
  '这个方法挺有意思。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:20+00',null,null,null,null,null
);
select extensions.results_eq(
  $$select prior_state,new_state,interval_days,next_due_at from owned_result$$,
  $$values('reused'::text,'owned'::text,30,'2026-09-19 12:20+00'::timestamptz)$$,
  'two contexts on separate UTC dates including due Practice advance reused to owned'
);

create temp table same_date_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000004','0e500000-0000-4000-8000-000000000004',repeat('e',64),
  '说实话，这部电影一般。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:30+00',null,null,null,null,null
);
select extensions.is(
  (select prior_state || '|' || new_state || '|' || interval_days::text from same_date_result),
  'reused|reused|7',
  'two contexts on the same UTC date do not satisfy owned threshold'
);

reset role;
create function pg_temp.reject_owned_next_review()
returns trigger language plpgsql as $$
begin
  if new.user_expression_id='0e300000-0000-4000-8000-000000000005'::uuid then
    raise exception using errcode='23514',message='forced next-review failure';
  end if;
  return new;
end
$$;
create trigger reject_owned_next_review
before insert on public.review_tasks
for each row execute function pg_temp.reject_owned_next_review();
set local role service_role;
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000005','0e500000-0000-4000-8000-000000000005',repeat('f',64),
    '谢谢。','hint',false,2,'Incorrect.',2,'Needs work.',2,'Does not fit.','2026-08-20 12:40+00',null,null,null,null,null)$$,
  '23514','forced next-review failure','a late next-review failure aborts the complete transaction'
);
reset role;
drop trigger reject_owned_next_review on public.review_tasks;
set local role service_role;
select extensions.is(
  (select r.status || '|' || u.mastery_state || '|' ||
      (select count(*) from public.attempts where practice_task_id='0e500000-0000-4000-8000-000000000005')::text || '|' ||
      (select count(*) from public.mastery_events where user_expression_id='0e300000-0000-4000-8000-000000000005')::text
    from public.review_tasks r join public.user_expressions u on u.id=r.user_expression_id
    where r.id='0e400000-0000-4000-8000-000000000005'),
  'pending|owned|0|0',
  'late failure preserves the pending review and leaves no attempt or mastery event'
);

create temp table owned_failure_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000005','0e500000-0000-4000-8000-000000000005',repeat('f',64),
  '谢谢。','hint',false,2,'Incorrect.',2,'Needs work.',2,'Does not fit.','2026-08-20 12:40+00',null,null,null,null,null
);
select extensions.is(
  (select prior_state || '|' || new_state || '|' || interval_days::text from owned_failure_result),
  'owned|owned|1',
  'owned is absorbing while failed or assisted maintenance retries in one day'
);

create temp table owned_success_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000007','0e500000-0000-4000-8000-000000000007',repeat('7',64),
  '慢慢来，我们一步一步做。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:50+00',null,null,null,null,null
);
select extensions.is(
  (select prior_state || '|' || new_state || '|' || interval_days::text from owned_success_result),
  'owned|owned|30',
  'owned is absorbing while successful independent maintenance schedules thirty days'
);

set local time zone 'America/New_York';
create temp table dst_seven_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000009','0e500000-0000-4000-8000-000000000009',repeat('9',64),
  '这个价格太夸张了。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-10-31 12:00-04',null,null,null,null,null
);
create temp table dst_one_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000010','0e500000-0000-4000-8000-000000000010',repeat('0',64),
  '没关系。','hint',true,4,'Accurate.',4,'Natural.',4,'Fits.','2026-10-31 12:00-04',null,null,null,null,null
);
create temp table dst_thirty_result as select * from public.complete_due_practice(
  :'user_a','0e400000-0000-4000-8000-000000000011','0e500000-0000-4000-8000-000000000011',repeat('1',64),
  '不用担心，我们准备好了。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-10-31 12:00-04',null,null,null,null,null
);
select extensions.results_eq(
  $$select interval_days,(extract(epoch from next_due_at-'2026-10-31 12:00-04'::timestamptz))::bigint
    from (
      select interval_days,next_due_at from dst_one_result
      union all select interval_days,next_due_at from dst_seven_result
      union all select interval_days,next_due_at from dst_thirty_result
    ) schedules order by interval_days$$,
  $$values (1,86400::bigint),(7,604800::bigint),(30,2592000::bigint)$$,
  'one, seven, and thirty day schedules remain exact 24-hour durations across New York DST'
);
set local time zone 'UTC';

select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000b002','0e400000-0000-4000-8000-000000000003','0e500000-0000-4000-8000-000000000003',repeat('1',64),
    '这个方法挺有意思。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-20 12:20+00',null,null,null,null,null)$$,
  '22023',null,'another owner cannot inspect or complete the due graph'
);
select extensions.throws_ok(
  $$select * from public.complete_due_practice(
    '0e000000-0000-4000-8000-00000000a001','0e400000-0000-4000-8000-000000000003','0e500000-0000-4000-8000-000000000003',repeat('2',64),
    '这个方法挺有意思。','none',true,5,'Accurate.',5,'Natural.',5,'Fits.','2026-08-19 12:20+00',null,null,null,null,null)$$,
  '40001',null,'completed or future/stale review cannot be completed again'
);

reset role;
select extensions.is((select count(*) from private.due_practice_completion_receipts),9::bigint,'one immutable receipt exists per completed review');
select * from extensions.finish();
rollback;
