-- Additive review snapshots. Scenario dedup is independent of the established
-- context_fingerprint/mastery algorithm; no existing question text is rewritten.
alter table public.practice_tasks
 add column transfer_type text,
 add column scenario_metadata_mode text,
 add column scenario_version integer not null default 1,
 add column scenario_fingerprint text,
 add column regenerated boolean not null default false,
 add column scenario_prompt_version text,
 add column scenario_model text,
 add column scenario_gateway_config_id uuid,
 add column scenario_gateway_revision integer,
 add column scenario_gateway_fingerprint text;
update public.practice_tasks set scenario_fingerprint=private.practice_situation_fingerprint(prompt_chinese) where kind='due_practice';
alter table public.practice_tasks
 add constraint review_scenario_version_check check(scenario_version>0),
 add constraint review_scenario_hash_check check((kind<>'due_practice' and scenario_fingerprint is null) or scenario_fingerprint ~ '^[a-f0-9]{64}$'),
 add constraint review_transfer_direction_check check(transfer_type is null or transfer_type in('near','far')),
 add constraint review_scenario_source_check check(scenario_source is null or scenario_source in('model','legacy','fallback')),
 add constraint review_scenario_metadata_check check(scenario_metadata_mode is null or scenario_metadata_mode in('modern','legacy')),
 add constraint review_scenario_function_check check(target_function is null or target_function in('emphasize','complain','praise','react','explain_sum_up','concede_contrast','suggest','connect_ideas','describe','other')),
 add constraint review_scenario_setting_check check(target_setting is null or target_setting in('casual_chat','daily_errands','work_school','formal_writing','online_social')),
 add constraint review_scenario_pin_owner_fk foreign key(scenario_gateway_config_id,user_id) references public.user_model_gateway_configs(id,user_id),
 add constraint review_scenario_pin_check check((scenario_gateway_config_id is null and scenario_gateway_revision is null and scenario_gateway_fingerprint is null) or (scenario_gateway_config_id is not null and scenario_gateway_revision>0 and scenario_gateway_fingerprint ~ '^[a-f0-9]{64}$'));
alter table public.review_tasks add column expression_revealed_at timestamptz;
alter table public.attempts add column coaching jsonb;

create table public.review_scenarios(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 review_task_id uuid not null,practice_task_id uuid not null,user_expression_id uuid not null,
 scenario_version integer not null check(scenario_version>0),
 scenario_fingerprint text not null check(scenario_fingerprint ~ '^[a-f0-9]{64}$'),
 context_fingerprint text not null check(context_fingerprint ~ '^[a-f0-9]{64}$'),
 prompt_chinese text not null,snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 created_at timestamptz not null default now(),
 unique(user_id,review_task_id,scenario_version),
 foreign key(review_task_id,user_id,user_expression_id) references public.review_tasks(id,user_id,user_expression_id),
 foreign key(practice_task_id,user_id,user_expression_id) references public.practice_tasks(id,user_id,user_expression_id)
);
create index review_scenarios_expression_history on public.review_scenarios(user_id,user_expression_id,created_at,id);
create index review_scenarios_dedup on public.review_scenarios(user_id,user_expression_id,scenario_fingerprint);

create table public.review_revisions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 request_id uuid not null,review_task_id uuid not null,attempt_id uuid not null,
 practice_task_id uuid not null,user_expression_id uuid not null,
 scenario_version integer not null check(scenario_version>0),scenario_fingerprint text not null check(scenario_fingerprint ~ '^[a-f0-9]{64}$'),
 response_chinese text not null check(private.is_target_chinese(response_chinese,10000)),
 evaluation jsonb not null check(jsonb_typeof(evaluation)='object'),coaching jsonb,
 evaluation_prompt_version text not null,evaluation_model text not null,
 evaluation_gateway_config_id uuid,evaluation_gateway_revision integer,evaluation_gateway_fingerprint text,
 created_at timestamptz not null default now(),
 unique(user_id,request_id),
 foreign key(review_task_id,user_id,user_expression_id) references public.review_tasks(id,user_id,user_expression_id),
 foreign key(attempt_id,user_id,user_expression_id) references public.attempts(id,user_id,user_expression_id),
 foreign key(practice_task_id,user_id,user_expression_id) references public.practice_tasks(id,user_id,user_expression_id),
 foreign key(evaluation_gateway_config_id,user_id) references public.user_model_gateway_configs(id,user_id)
);
create index review_revision_latest on public.review_revisions(user_id,review_task_id,created_at desc,id desc);

create table private.review_operations(
 user_id uuid not null,review_task_id uuid not null,request_id uuid not null,
 kind text not null check(kind in('prepare','regenerate','complete','revision')),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 status text not null check(status in('claimed','succeeded','failed','waiting')),
 claim_token uuid,lease_expires_at timestamptz,expected_version integer not null,
 expected_fingerprint text,linked_request_id uuid,
 job_id uuid,job_attempt_count integer,job_lease_expires_at timestamptz,
 response jsonb,error_code text,created_at timestamptz not null,updated_at timestamptz not null,
 primary key(user_id,request_id),
 foreign key(review_task_id,user_id) references public.review_tasks(id,user_id),
 foreign key(user_id,linked_request_id) references private.review_operations(user_id,request_id),
 foreign key(job_id,user_id) references public.knowledge_jobs(id,user_id),
 check((status='claimed' and claim_token is not null and lease_expires_at is not null) or status<>'claimed')
);
create unique index review_one_active_preparation on private.review_operations(user_id,review_task_id) where status='claimed' and kind in('prepare','regenerate');
create index review_operation_lookup on private.review_operations(user_id,review_task_id,kind,created_at desc);

alter table public.review_scenarios enable row level security;
alter table public.review_revisions enable row level security;
alter table private.review_operations enable row level security;
revoke all on public.review_scenarios,public.review_revisions from public,anon,authenticated;
grant select on public.review_scenarios,public.review_revisions to authenticated;
grant select,insert on public.review_scenarios,public.review_revisions to service_role;
create policy review_scenario_owned_read on public.review_scenarios for select to authenticated using(user_id=(select auth.uid()));
create policy review_revision_owned_read on public.review_revisions for select to authenticated using(user_id=(select auth.uid()));
revoke all on private.review_operations from public,anon,authenticated,service_role;

create function public.read_review_practice_context(p_user_id uuid,p_review_task_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object(
  'review',to_jsonb(r),'expression',to_jsonb(e),'sense',to_jsonb(s),
  'task',(select to_jsonb(t) from public.practice_tasks t where t.user_id=p_user_id and t.review_task_id=r.id and t.user_expression_id=e.id and t.kind='due_practice'),
  'canonicalCard',jsonb_build_object('meaningHere',s.meaning_here,'useItWhen',s.use_it_when,'comparedWith',s.compared_with,'howItFits',s.how_it_fits,'toneAndWho',s.tone_and_who,'watchOut',s.watch_out,'examples',s.examples,'functionCategories',s.function_categories,'usageSettings',s.usage_settings,'suitability','expression'),
  'linkedCard',(select c.card from private.practice_promotion_receipts receipt cross join lateral private.today_candidate_cards(p_user_id) c where receipt.user_id=p_user_id and receipt.user_expression_id=e.id and c.candidate_key=receipt.candidate_key limit 1),
  'history',(with history as (
   select t.prompt_chinese,t.created_at from public.practice_tasks t where t.user_id=p_user_id and t.user_expression_id=e.id
   union all select d.prompt_chinese,d.created_at from public.practice_drafts d join private.practice_promotion_receipts receipt on receipt.user_id=p_user_id and receipt.user_expression_id=e.id and receipt.candidate_key=d.candidate_key where d.user_id=p_user_id
   union all select h.prompt_chinese,h.created_at from public.review_scenarios h where h.user_id=p_user_id and h.user_expression_id=e.id
  ), texts as(select prompt_chinese,min(created_at) as created_at from history group by prompt_chinese)
  select coalesce(jsonb_agg(prompt_chinese order by created_at,prompt_chinese),'[]'::jsonb) from texts),
  'lastTransferType',(select t.transfer_type from public.practice_tasks t join public.review_tasks previous on previous.id=t.review_task_id and previous.user_id=p_user_id where t.user_id=p_user_id and t.user_expression_id=e.id and t.kind='due_practice' and t.review_task_id<>r.id and t.transfer_type in('near','far') order by previous.due_at desc,t.created_at desc,t.id desc limit 1),
  'officialAttempt',(select to_jsonb(a) from public.attempts a where a.user_id=p_user_id and a.id=r.completed_attempt_id and a.user_expression_id=e.id),
  'receipt',(select to_jsonb(receipt) from private.due_practice_completion_receipts receipt where receipt.user_id=p_user_id and receipt.review_task_id=r.id and receipt.user_expression_id=e.id),
  'latestRevision',(select to_jsonb(revision) from public.review_revisions revision where revision.user_id=p_user_id and revision.review_task_id=r.id and revision.attempt_id=r.completed_attempt_id order by revision.created_at desc,revision.id desc limit 1)
 ) from public.review_tasks r join public.user_expressions e on e.id=r.user_expression_id and e.user_id=p_user_id
 join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=p_user_id
 where r.user_id=p_user_id and r.id=p_review_task_id
$$;
revoke all on function public.read_review_practice_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_review_practice_context(uuid,uuid) to service_role;
