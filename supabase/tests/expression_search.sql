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
  ('0d200000-0000-4000-8000-000000000002',:'user_a',:'source_a2','太 离谱了。','太离谱了',
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
  ('0d300000-0000-4000-8000-000000000001',:'user_a','0d200000-0000-4000-8000-000000000001','tried','2026-08-01','2026-08-01'),
  ('0d300000-0000-4000-8000-000000000002',:'user_a','0d200000-0000-4000-8000-000000000002','reused','2026-08-02','2026-08-02'),
  ('0d300000-0000-4000-8000-000000000003',:'user_a','0d200000-0000-4000-8000-000000000003','tried','2026-08-03','2026-08-03'),
  ('0d300000-0000-4000-8000-000000000004',:'user_a','0d200000-0000-4000-8000-000000000004','owned','2026-08-04','2026-08-04'),
  ('0d300000-0000-4000-8000-000000000005',:'user_a','0d200000-0000-4000-8000-000000000005','tried','2026-08-05','2026-08-05'),
  ('0d300000-0000-4000-8000-000000000006',:'user_a','0d200000-0000-4000-8000-000000000006','reused','2026-08-06','2026-08-06'),
  ('0d300000-0000-4000-8000-000000000007',:'user_a','0d200000-0000-4000-8000-000000000007','owned','2026-08-07','2026-08-07'),
  ('0d300000-0000-4000-8000-000000000008',:'user_b','0d200000-0000-4000-8000-000000000008','owned','2026-08-20','2026-08-20');

select extensions.ok(
  has_function_privilege('service_role',
    'public.search_expressions(uuid,text,text,text,uuid,text,timestamptz,timestamptz,integer)',
    'execute'),
  'service role can execute expression search'
);
select extensions.ok(
  not has_function_privilege('authenticated',
    'public.search_expressions(uuid,text,text,text,uuid,text,timestamptz,timestamptz,integer)',
    'execute')
  and not has_function_privilege('anon',
    'public.search_expressions(uuid,text,text,text,uuid,text,timestamptz,timestamptz,integer)',
    'execute'),
  'client roles cannot execute service-owned expression search'
);

set local role service_role;

select extensions.results_eq(
  $$select expression_text,match_reason from public.search_expressions(
      '0d000000-0000-4000-8000-00000000a001','太离谱了',null,null,null,null,null,null,10)
    order by array_position(array['exact','prefix','substring','trigram'],match_reason),updated_at desc,user_expression_id$$,
  $$values
    ('太 离谱了。'::text,'exact'::text),
    ('太离谱了'::text,'exact'::text),
    ('太离谱了吧'::text,'prefix'::text),
    ('这太离谱了'::text,'substring'::text),
    ('太离普了'::text,'trigram'::text)$$,
  'Chinese search normalizes punctuation and whitespace and ranks exact, prefix, substring, then trigram'
);

select extensions.results_eq(
  $$select expression_text,source_count,match_reason from public.search_expressions(
      '0d000000-0000-4000-8000-00000000a001','　太 离谱了！',null,null,null,null,null,null,2)
    order by updated_at desc,user_expression_id$$,
  $$values
    ('太 离谱了。'::text,2::bigint,'exact'::text),
    ('太离谱了'::text,2::bigint,'exact'::text)$$,
  'source overlap counts distinct owned videos for the same normalized expression'
);

select extensions.results_eq(
  $$select expression_text,match_reason from public.search_expressions(
      '0d000000-0000-4000-8000-00000000a001','absurd',null,null,null,null,null,null,10)
    order by updated_at desc,user_expression_id$$,
  $$values
    ('莫名其妙'::text,'english_meaning'::text),
    ('太离谱了'::text,'english_meaning'::text)$$,
  'English meaning search is bounded and owner scoped'
);

select extensions.results_eq(
  $$select expression_text,match_reason from public.search_expressions(
      '0d000000-0000-4000-8000-00000000a001','polite request',null,'polite',
      '0d100000-0000-4000-8000-000000000002','owned','2026-08-07','2026-08-08',10)$$,
  $$values ('麻烦你了'::text,'communicative_function'::text)$$,
  'metadata, source, mastery, and half-open date filters compose'
);

select extensions.results_eq(
  $$select expression_text,match_reason from public.search_expressions(
      '0d000000-0000-4000-8000-00000000a001','',null,null,null,null,null,null,3)
    order by updated_at desc,user_expression_id$$,
  $$values
    ('麻烦你了'::text,'recent'::text),
    ('莫名其妙'::text,'recent'::text),
    ('太离普了'::text,'recent'::text)$$,
  'empty query returns only the bounded most recent Vault rows'
);

select extensions.is(
  (select count(*) from public.search_expressions(
    '0d000000-0000-4000-8000-00000000a001','%_',null,null,null,null,null,null,50)),
  0::bigint,
  'percent and underscore are literals, not wildcard injection'
);
select extensions.is(
  (select count(*) from public.search_expressions(
    '0d000000-0000-4000-8000-00000000a001','太离谱了',null,null,null,null,null,null,50)
    where user_expression_id='0d300000-0000-4000-8000-000000000008'),
  0::bigint,
  'another owner never appears even when newer and exact'
);

select extensions.throws_ok(
  $$select * from public.search_expressions(null,'',null,null,null,null,null,null,20)$$,
  '22023',null,'null owner is rejected'
);
select extensions.throws_ok(
  $$select * from public.search_expressions('0d000000-0000-4000-8000-00000000a001',repeat('太',201),null,null,null,null,null,null,20)$$,
  '22023',null,'overlong query is rejected'
);
select extensions.throws_ok(
  $$select * from public.search_expressions('0d000000-0000-4000-8000-00000000a001','',null,null,null,'mastered',null,null,20)$$,
  '22023',null,'unknown mastery state is rejected'
);
select extensions.throws_ok(
  $$select * from public.search_expressions('0d000000-0000-4000-8000-00000000a001','',null,null,null,null,null,null,51)$$,
  '22023',null,'result limit is capped at fifty'
);
select extensions.throws_ok(
  $$select * from public.search_expressions('0d000000-0000-4000-8000-00000000a001','',null,null,null,null,'2026-08-08','2026-08-08',20)$$,
  '22023',null,'date bounds must form a strict half-open interval'
);
select extensions.throws_ok(
  $$select * from public.search_expressions('0d000000-0000-4000-8000-00000000a001','','   ',null,null,null,null,null,20)$$,
  '22023',null,'blank metadata filters are rejected'
);

reset role;
select * from extensions.finish();
rollback;
