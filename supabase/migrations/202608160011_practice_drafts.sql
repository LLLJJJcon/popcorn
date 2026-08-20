alter table public.generated_artifacts
  add constraint generated_artifact_owner_source_save_type_key
  unique (id, user_id, video_source_id, saved_item_id, artifact_type);

create table public.practice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  video_source_id uuid not null,
  saved_item_id uuid not null,
  candidate_artifact_id uuid not null,
  candidate_artifact_type text not null default 'saved_item_analysis',
  candidate_index integer not null,
  future_user_expression_id uuid not null,
  native_language text not null,
  target_language text not null,
  target_expression text not null,
  prompt_chinese text not null,
  instructions_english text not null,
  goal_english text not null,
  status text not null default 'active',
  activation_prompt_version text,
  activation_model text,
  activation_gateway_config_id uuid,
  activation_gateway_revision integer,
  activation_gateway_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_draft_owner_key unique (id, user_id),
  constraint practice_draft_future_expression_key
    unique (future_user_expression_id),
  constraint practice_draft_future_owner_key
    unique (id, user_id, future_user_expression_id),
  constraint practice_draft_source_owner_fk foreign key (video_source_id, user_id)
    references public.video_sources(id, user_id) on delete restrict,
  constraint practice_draft_save_owner_fk foreign key (
    saved_item_id, user_id, video_source_id
  ) references public.saved_items (id, user_id, video_source_id) on delete restrict,
  constraint practice_draft_candidate_owner_fk foreign key (
    candidate_artifact_id, user_id, video_source_id, saved_item_id,
    candidate_artifact_type
  ) references public.generated_artifacts (
    id, user_id, video_source_id, saved_item_id, artifact_type
  ) on delete restrict,
  constraint practice_draft_candidate_type_check
    check (candidate_artifact_type = 'saved_item_analysis'),
  constraint practice_draft_candidate_index_check
    check (candidate_index between 0 and 2),
  constraint practice_draft_language_check
    check (native_language = 'en' and target_language = 'zh-CN'),
  constraint practice_draft_text_check check (
    private.is_target_chinese(target_expression, 200)
    and private.is_target_chinese(prompt_chinese, 2000)
    and private.is_basic_latin_english(instructions_english, 1000)
    and private.is_basic_latin_english(goal_english, 1000)
  ),
  constraint practice_draft_status_check
    check (status in ('active', 'completed', 'abandoned')),
  constraint practice_draft_activation_metadata_check check (
    (activation_prompt_version is null
      and activation_model is null
      and activation_gateway_config_id is null
      and activation_gateway_revision is null
      and activation_gateway_fingerprint is null)
    or
    (activation_prompt_version is not null
      and activation_model is not null
      and activation_gateway_config_id is not null
      and activation_gateway_revision is not null
      and activation_gateway_fingerprint is not null
      and length(activation_prompt_version) between 1 and 100
      and activation_prompt_version = btrim(activation_prompt_version)
      and length(activation_model) between 1 and 100
      and activation_model = btrim(activation_model)
      and activation_gateway_revision > 0
      and activation_gateway_fingerprint ~ '^[a-f0-9]{64}$')
  ),
  constraint practice_draft_activation_gateway_fk foreign key (
    activation_gateway_config_id, user_id, activation_gateway_revision,
    activation_gateway_fingerprint, activation_model
  ) references public.user_model_gateway_configs (
    id, user_id, revision, config_fingerprint, model
  ) on delete restrict
);

create index practice_drafts_owner_status_created_idx
  on public.practice_drafts (user_id, status, created_at desc);
create index practice_drafts_candidate_idx
  on public.practice_drafts (candidate_artifact_id, user_id, candidate_index);

create function private.validate_practice_draft_candidate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate_expression_json jsonb;
  candidate_expression text;
begin
  select
    artifact.content -> 'candidates' -> new.candidate_index -> 'expression'
  into candidate_expression_json
  from public.generated_artifacts as artifact
  where artifact.id = new.candidate_artifact_id
    and artifact.user_id = new.user_id
    and artifact.video_source_id = new.video_source_id
    and artifact.saved_item_id = new.saved_item_id
    and artifact.artifact_type = new.candidate_artifact_type;

  if not found then
    return new;
  end if;

  if jsonb_typeof(candidate_expression_json) is distinct from 'string' then
    raise exception using
      errcode = '23514',
      constraint = 'practice_draft_candidate_content_check',
      message = 'practice draft candidate expression is missing or not a string';
  end if;

  candidate_expression := candidate_expression_json #>> '{}';
  if candidate_expression is distinct from new.target_expression then
    raise exception using
      errcode = '23514',
      constraint = 'practice_draft_candidate_content_check',
      message = 'practice draft target expression does not match candidate';
  end if;

  return new;
end;
$$;

create trigger practice_draft_candidate_content_trigger
before insert on public.practice_drafts
for each row execute function private.validate_practice_draft_candidate();

create table public.practice_draft_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  practice_draft_id uuid not null,
  future_user_expression_id uuid not null,
  revision integer not null,
  response_chinese text not null,
  passed boolean not null,
  accuracy_score integer not null,
  accuracy_feedback_english text not null,
  naturalness_score integer not null,
  naturalness_feedback_english text not null,
  contextual_fit_score integer not null,
  contextual_fit_feedback_english text not null,
  independent_use boolean not null,
  assistance_level text not null,
  submitted_at timestamptz not null,
  evaluation_prompt_version text,
  evaluation_model text,
  evaluation_gateway_config_id uuid,
  evaluation_gateway_revision integer,
  evaluation_gateway_fingerprint text,
  created_at timestamptz not null default now(),
  constraint practice_draft_attempt_owner_key unique (id, user_id),
  constraint practice_draft_attempt_revision_key
    unique (practice_draft_id, revision),
  constraint practice_draft_attempt_draft_owner_fk foreign key (
    practice_draft_id, user_id, future_user_expression_id
  ) references public.practice_drafts (
    id, user_id, future_user_expression_id
  ) on delete restrict,
  constraint practice_draft_attempt_revision_check
    check (revision > 0),
  constraint practice_draft_attempt_response_check
    check (private.is_target_chinese(response_chinese, 5000)),
  constraint practice_draft_attempt_score_check check (
    accuracy_score between 1 and 5
    and naturalness_score between 1 and 5
    and contextual_fit_score between 1 and 5
  ),
  constraint practice_draft_attempt_feedback_check check (
    private.is_basic_latin_english(accuracy_feedback_english, 2000)
    and private.is_basic_latin_english(naturalness_feedback_english, 2000)
    and private.is_basic_latin_english(contextual_fit_feedback_english, 2000)
  ),
  constraint practice_draft_attempt_assistance_check
    check (assistance_level in ('none', 'hint', 'model_answer')),
  constraint practice_draft_attempt_independent_check
    check (not independent_use or assistance_level = 'none'),
  constraint practice_draft_attempt_evaluation_metadata_check check (
    (evaluation_prompt_version is null
      and evaluation_model is null
      and evaluation_gateway_config_id is null
      and evaluation_gateway_revision is null
      and evaluation_gateway_fingerprint is null)
    or
    (evaluation_prompt_version is not null
      and evaluation_model is not null
      and evaluation_gateway_config_id is not null
      and evaluation_gateway_revision is not null
      and evaluation_gateway_fingerprint is not null
      and length(evaluation_prompt_version) between 1 and 100
      and evaluation_prompt_version = btrim(evaluation_prompt_version)
      and length(evaluation_model) between 1 and 100
      and evaluation_model = btrim(evaluation_model)
      and evaluation_gateway_revision > 0
      and evaluation_gateway_fingerprint ~ '^[a-f0-9]{64}$')
  ),
  constraint practice_draft_attempt_evaluation_gateway_fk foreign key (
    evaluation_gateway_config_id, user_id, evaluation_gateway_revision,
    evaluation_gateway_fingerprint, evaluation_model
  ) references public.user_model_gateway_configs (
    id, user_id, revision, config_fingerprint, model
  ) on delete restrict
);

create index practice_draft_attempts_owner_draft_revision_idx
  on public.practice_draft_attempts (user_id, practice_draft_id, revision);

alter table public.practice_drafts enable row level security;
alter table public.practice_draft_attempts enable row level security;

revoke all on table public.practice_drafts
  from public, anon, authenticated, service_role;
revoke all on table public.practice_draft_attempts
  from public, anon, authenticated, service_role;
grant select on table public.practice_drafts to authenticated;
grant select on table public.practice_draft_attempts to authenticated;
grant select, insert on table public.practice_drafts to service_role;
grant update (status, updated_at) on table public.practice_drafts to service_role;
grant select, insert on table public.practice_draft_attempts to service_role;

create policy practice_drafts_select_own on public.practice_drafts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy practice_draft_attempts_select_own on public.practice_draft_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.practice_drafts is
  'Durable pre-Vault activation context tied to one source-grounded saved-item candidate; future_user_expression_id is promoted only after valid learner evidence.';
comment on table public.practice_draft_attempts is
  'Append-only evaluated learner revisions staged before Task 5 atomically creates canonical practice, Vault, mastery, and review evidence.';
