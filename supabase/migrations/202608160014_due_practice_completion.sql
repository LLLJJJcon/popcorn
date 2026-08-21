alter table public.review_tasks
  add constraint review_task_owner_expression_key unique (id, user_id, user_expression_id),
  add column completed_attempt_id uuid,
  add column completed_at timestamptz;

alter table public.practice_tasks
  add column review_task_id uuid,
  add column context_fingerprint text;

create function private.compute_practice_context_fingerprint(
  p_target_expression text,
  p_prompt_chinese text,
  p_instructions_english text,
  p_goal_english text
)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.char_length(p_target_expression)::text || ':' || p_target_expression ||
    pg_catalog.char_length(p_prompt_chinese)::text || ':' || p_prompt_chinese ||
    pg_catalog.char_length(p_instructions_english)::text || ':' || p_instructions_english ||
    pg_catalog.char_length(p_goal_english)::text || ':' || p_goal_english,
    'UTF8'
  ), 'sha256'), 'hex')
$$;

revoke all on function private.compute_practice_context_fingerprint(text,text,text,text) from public;

create function private.set_practice_context_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.context_fingerprint := private.compute_practice_context_fingerprint(
    new.target_expression, new.prompt_chinese, new.instructions_english, new.goal_english
  );
  return new;
end
$$;

revoke all on function private.set_practice_context_fingerprint() from public;

create trigger practice_task_context_fingerprint_set
before insert or update of target_expression, prompt_chinese, instructions_english, goal_english
on public.practice_tasks
for each row execute function private.set_practice_context_fingerprint();

update public.practice_tasks
set context_fingerprint = private.compute_practice_context_fingerprint(
  target_expression, prompt_chinese, instructions_english, goal_english
);

alter table public.practice_tasks
  alter column context_fingerprint set not null,
  add constraint practice_task_context_fingerprint_check
    check (context_fingerprint ~ '^[a-f0-9]{64}$'),
  add constraint practice_task_review_owner_fk foreign key (
    review_task_id, user_id, user_expression_id
  ) references public.review_tasks (id, user_id, user_expression_id) on delete restrict,
  add constraint practice_task_review_kind_check check (
    (kind = 'use_it_now' and review_task_id is null)
    or kind = 'due_practice'
  ),
  add constraint practice_task_expression_context_unique
    unique (user_id, user_expression_id, context_fingerprint);

create unique index practice_tasks_review_unique
  on public.practice_tasks (review_task_id)
  where review_task_id is not null;
create unique index review_tasks_one_pending_expression
  on public.review_tasks (user_id, user_expression_id)
  where status = 'pending';

alter table public.review_tasks
  add constraint review_task_completed_attempt_owner_fk foreign key (
    completed_attempt_id, user_id, user_expression_id
  ) references public.attempts (id, user_id, user_expression_id) on delete restrict,
  add constraint review_task_completion_lifecycle_check check (
    (status = 'pending' and completed_attempt_id is null and completed_at is null)
    or (status = 'completed' and completed_attempt_id is not null and completed_at is not null)
    or (status = 'cancelled' and completed_attempt_id is null and completed_at is null)
  );

create table private.due_practice_completion_receipts (
  review_task_id uuid primary key,
  user_id uuid not null,
  user_expression_id uuid not null,
  practice_task_id uuid not null,
  request_key text not null,
  attempt_id uuid not null,
  mastery_event_id uuid not null,
  next_review_task_id uuid not null,
  prior_state text not null,
  new_state text not null,
  next_due_at timestamptz not null,
  interval_days integer not null,
  completed_at timestamptz not null,
  created_at timestamptz not null,
  constraint due_completion_receipt_request_key_check check (request_key ~ '^[a-f0-9]{64}$'),
  constraint due_completion_receipt_state_check check (
    prior_state in ('tried','reused','owned') and new_state in ('tried','reused','owned')
  ),
  constraint due_completion_receipt_interval_check check (interval_days in (1,7,30)),
  constraint due_completion_receipt_review_owner_fk foreign key (
    review_task_id, user_id, user_expression_id
  ) references public.review_tasks (id, user_id, user_expression_id) on delete restrict,
  constraint due_completion_receipt_task_owner_fk foreign key (
    practice_task_id, user_id, user_expression_id
  ) references public.practice_tasks (id, user_id, user_expression_id) on delete restrict,
  constraint due_completion_receipt_attempt_owner_fk foreign key (
    attempt_id, user_id, user_expression_id
  ) references public.attempts (id, user_id, user_expression_id) on delete restrict,
  constraint due_completion_receipt_event_owner_fk foreign key (
    mastery_event_id, user_id
  ) references public.mastery_events (id, user_id) on delete restrict,
  constraint due_completion_receipt_next_review_owner_fk foreign key (
    next_review_task_id, user_id, user_expression_id
  ) references public.review_tasks (id, user_id, user_expression_id) on delete restrict
);

alter table private.due_practice_completion_receipts enable row level security;
revoke all on table private.due_practice_completion_receipts
  from public, anon, authenticated, service_role;

create function public.complete_due_practice(
  p_user_id uuid,
  p_review_task_id uuid,
  p_practice_task_id uuid,
  p_request_key text,
  p_response_chinese text,
  p_assistance_level text,
  p_passed boolean,
  p_accuracy_score integer,
  p_accuracy_feedback_english text,
  p_naturalness_score integer,
  p_naturalness_feedback_english text,
  p_contextual_fit_score integer,
  p_contextual_fit_feedback_english text,
  p_completed_at timestamptz,
  p_evaluation_prompt_version text default null,
  p_evaluation_model text default null,
  p_evaluation_gateway_config_id uuid default null,
  p_evaluation_gateway_revision integer default null,
  p_evaluation_gateway_fingerprint text default null
)
returns table (
  review_task_id uuid,
  practice_task_id uuid,
  attempt_id uuid,
  mastery_event_id uuid,
  next_review_task_id uuid,
  prior_state text,
  new_state text,
  next_due_at timestamptz,
  interval_days integer,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_review public.review_tasks%rowtype;
  v_expression public.user_expressions%rowtype;
  v_task public.practice_tasks%rowtype;
  v_receipt private.due_practice_completion_receipts%rowtype;
  v_existing_attempt public.attempts%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_next_review_id uuid := gen_random_uuid();
  v_independent boolean;
  v_prior_state text;
  v_new_state text;
  v_evidence_kind text;
  v_contexts integer;
  v_dates integer;
  v_includes_due boolean;
  v_interval integer;
  v_next_due timestamptz;
  v_successes integer;
begin
  if p_user_id is null or p_review_task_id is null or p_practice_task_id is null
    or p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$'
    or p_response_chinese is null
    or p_assistance_level not in ('none','hint','model_answer')
    or p_passed is null
    or p_accuracy_score not between 1 and 5
    or p_naturalness_score not between 1 and 5
    or p_contextual_fit_score not between 1 and 5
    or p_accuracy_feedback_english is null
    or p_naturalness_feedback_english is null
    or p_contextual_fit_feedback_english is null
    or p_completed_at is null or not pg_catalog.isfinite(p_completed_at)
  then
    raise exception using errcode='22023', message='invalid due Practice completion input';
  end if;

  select * into v_review from public.review_tasks as review
  where review.id=p_review_task_id and review.user_id=p_user_id
  for update;
  if not found then
    raise exception using errcode='22023', message='owned due review not found';
  end if;

  select * into v_receipt from private.due_practice_completion_receipts as receipt
  where receipt.review_task_id=p_review_task_id;
  if found then
    select * into v_existing_attempt from public.attempts as attempt
    where attempt.id=v_receipt.attempt_id and attempt.user_id=p_user_id;
    if v_receipt.user_id<>p_user_id or v_receipt.practice_task_id<>p_practice_task_id
      or v_receipt.request_key<>p_request_key
      or v_existing_attempt.id is null
      or v_existing_attempt.response_chinese<>p_response_chinese
      or v_existing_attempt.assistance_level<>p_assistance_level
      or v_existing_attempt.passed<>p_passed
      or v_existing_attempt.accuracy_score<>p_accuracy_score
      or v_existing_attempt.accuracy_feedback_english<>p_accuracy_feedback_english
      or v_existing_attempt.naturalness_score<>p_naturalness_score
      or v_existing_attempt.naturalness_feedback_english<>p_naturalness_feedback_english
      or v_existing_attempt.contextual_fit_score<>p_contextual_fit_score
      or v_existing_attempt.contextual_fit_feedback_english<>p_contextual_fit_feedback_english
      or v_existing_attempt.submitted_at<>p_completed_at
      or v_existing_attempt.evaluation_prompt_version is distinct from p_evaluation_prompt_version
      or v_existing_attempt.evaluation_model is distinct from p_evaluation_model
      or v_existing_attempt.evaluation_gateway_config_id is distinct from p_evaluation_gateway_config_id
      or v_existing_attempt.evaluation_gateway_revision is distinct from p_evaluation_gateway_revision
      or v_existing_attempt.evaluation_gateway_fingerprint is distinct from p_evaluation_gateway_fingerprint then
      raise exception using errcode='40001', message='due Practice completion conflicts with receipt';
    end if;
    return query select v_receipt.review_task_id,v_receipt.practice_task_id,
      v_receipt.attempt_id,v_receipt.mastery_event_id,v_receipt.next_review_task_id,
      v_receipt.prior_state,v_receipt.new_state,v_receipt.next_due_at,
      v_receipt.interval_days,false;
    return;
  end if;

  if v_review.status<>'pending' or v_review.completed_attempt_id is not null
    or v_review.completed_at is not null or v_review.due_at>p_completed_at then
    raise exception using errcode='40001', message='due review is stale or not due';
  end if;

  select * into v_expression from public.user_expressions as expression
  where expression.id=v_review.user_expression_id and expression.user_id=p_user_id
  for update;
  select * into v_task from public.practice_tasks as task
  where task.id=p_practice_task_id and task.user_id=p_user_id
  for update;
  if v_expression.id is null or v_task.id is null
    or v_task.kind<>'due_practice'
    or v_task.review_task_id is distinct from v_review.id
    or v_task.user_expression_id<>v_review.user_expression_id
    or v_task.due_at is distinct from v_review.due_at
    or v_review.mastery_state<>v_expression.mastery_state then
    raise exception using errcode='22023', message='due Practice graph mismatch';
  end if;

  v_independent := p_passed and p_assistance_level='none';
  v_prior_state := v_expression.mastery_state;

  insert into public.attempts(
    id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
    accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
    contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,
    submitted_at,created_at,evaluation_prompt_version,evaluation_model,
    evaluation_gateway_config_id,evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (
    v_attempt_id,p_user_id,v_task.id,v_expression.id,p_response_chinese,p_passed,
    p_accuracy_score,p_accuracy_feedback_english,p_naturalness_score,p_naturalness_feedback_english,
    p_contextual_fit_score,p_contextual_fit_feedback_english,v_independent,p_assistance_level,
    p_completed_at,p_completed_at,p_evaluation_prompt_version,p_evaluation_model,
    p_evaluation_gateway_config_id,p_evaluation_gateway_revision,p_evaluation_gateway_fingerprint
  );

  select pg_catalog.count(distinct task.context_fingerprint)::integer,
    pg_catalog.count(distinct (attempt.submitted_at at time zone 'UTC')::date)::integer,
    pg_catalog.bool_or(task.kind='due_practice')
  into v_contexts,v_dates,v_includes_due
  from public.attempts as attempt
  join public.practice_tasks as task
    on task.id=attempt.practice_task_id and task.user_id=p_user_id
  where attempt.user_id=p_user_id and attempt.user_expression_id=v_expression.id
    and attempt.passed and attempt.independent_use and attempt.assistance_level='none';

  if not v_independent then
    v_new_state:=v_prior_state;
    v_evidence_kind:='failed_or_assisted_reuse';
    v_interval:=1;
  elsif v_prior_state='tried' then
    v_new_state:='reused';
    v_evidence_kind:='successful_independent_transfer';
    v_interval:=7;
  elsif v_prior_state='reused' and v_contexts>=2 and v_dates>=2 and v_includes_due then
    v_new_state:='owned';
    v_evidence_kind:='owned_threshold_met';
    v_interval:=30;
  elsif v_prior_state='reused' then
    v_new_state:='reused';
    v_evidence_kind:='successful_independent_transfer';
    v_interval:=7;
  else
    v_new_state:='owned';
    v_evidence_kind:='owned_threshold_met';
    v_interval:=30;
  end if;
  v_next_due:=p_completed_at+pg_catalog.make_interval(hours=>v_interval*24);
  v_successes:=case
    when not v_independent then 0
    when v_review.consecutive_successes>=1000 then 1000
    else v_review.consecutive_successes+1
  end;

  insert into public.mastery_events(
    id,user_id,user_expression_id,attempt_id,prior_state,new_state,evidence_kind,occurred_at,created_at
  ) values (
    v_event_id,p_user_id,v_expression.id,v_attempt_id,v_prior_state,v_new_state,
    v_evidence_kind,p_completed_at,p_completed_at
  );
  update public.user_expressions set mastery_state=v_new_state,updated_at=p_completed_at
  where id=v_expression.id and user_id=p_user_id;
  update public.review_tasks set status='completed',completed_attempt_id=v_attempt_id,
    completed_at=p_completed_at,updated_at=p_completed_at
  where id=v_review.id and user_id=p_user_id and status='pending';
  if not found then
    raise exception using errcode='40001', message='due review completion lost its pending fence';
  end if;
  insert into public.review_tasks(
    id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,
    consecutive_successes,created_at,updated_at
  ) values (
    v_next_review_id,p_user_id,v_expression.id,v_new_state,'pending',v_next_due,v_interval,
    v_successes,p_completed_at,p_completed_at
  );
  insert into private.due_practice_completion_receipts(
    review_task_id,user_id,user_expression_id,practice_task_id,request_key,
    attempt_id,mastery_event_id,next_review_task_id,prior_state,new_state,
    next_due_at,interval_days,completed_at,created_at
  ) values (
    v_review.id,p_user_id,v_expression.id,v_task.id,p_request_key,
    v_attempt_id,v_event_id,v_next_review_id,v_prior_state,v_new_state,
    v_next_due,v_interval,p_completed_at,p_completed_at
  );

  return query select v_review.id,v_task.id,v_attempt_id,v_event_id,v_next_review_id,
    v_prior_state,v_new_state,v_next_due,v_interval,true;
end
$$;

revoke all on function public.complete_due_practice(
  uuid,uuid,uuid,text,text,text,boolean,integer,text,integer,text,integer,text,
  timestamptz,text,text,uuid,integer,text
) from public,anon,authenticated;
grant execute on function public.complete_due_practice(
  uuid,uuid,uuid,text,text,text,boolean,integer,text,integer,text,integer,text,
  timestamptz,text,text,uuid,integer,text
) to service_role;

comment on function public.complete_due_practice(
  uuid,uuid,uuid,text,text,text,boolean,integer,text,integer,text,integer,text,
  timestamptz,text,text,uuid,integer,text
) is 'Atomically records one due Practice attempt, deterministic mastery evidence, and the next review from owned persisted evidence.';
