alter table public.profiles enable row level security;
alter table public.video_sources enable row level security;
alter table public.video_snapshots enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.saved_items enable row level security;
alter table public.generated_artifacts enable row level security;
alter table public.knowledge_jobs enable row level security;
alter table public.expression_senses enable row level security;
alter table public.expression_occurrences enable row level security;
alter table public.user_expressions enable row level security;
alter table public.practice_tasks enable row level security;
alter table public.attempts enable row level security;
alter table public.mastery_events enable row level security;
alter table public.review_tasks enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.video_sources from anon, authenticated;
revoke all on table public.video_snapshots from anon, authenticated;
revoke all on table public.transcript_segments from anon, authenticated;
revoke all on table public.saved_items from anon, authenticated;
revoke all on table public.generated_artifacts from anon, authenticated;
revoke all on table public.knowledge_jobs from anon, authenticated;
revoke all on table public.expression_senses from anon, authenticated;
revoke all on table public.expression_occurrences from anon, authenticated;
revoke all on table public.user_expressions from anon, authenticated;
revoke all on table public.practice_tasks from anon, authenticated;
revoke all on table public.attempts from anon, authenticated;
revoke all on table public.mastery_events from anon, authenticated;
revoke all on table public.review_tasks from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert on table public.video_sources to authenticated;
grant select, insert on table public.video_snapshots to authenticated;
grant select, insert on table public.transcript_segments to authenticated;
grant select, insert on table public.saved_items to authenticated;
grant select on table public.generated_artifacts to authenticated;
grant select on table public.knowledge_jobs to authenticated;
grant select on table public.expression_senses to authenticated;
grant select on table public.expression_occurrences to authenticated;
grant select on table public.user_expressions to authenticated;
grant select on table public.practice_tasks to authenticated;
grant select on table public.attempts to authenticated;
grant select on table public.mastery_events to authenticated;
grant select on table public.review_tasks to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy video_sources_select_own on public.video_sources
  for select to authenticated using ((select auth.uid()) = user_id);
create policy video_sources_insert_own on public.video_sources
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy video_snapshots_select_own on public.video_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy video_snapshots_insert_own on public.video_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy transcript_segments_select_own on public.transcript_segments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy transcript_segments_insert_own on public.transcript_segments
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy saved_items_select_own on public.saved_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy saved_items_insert_own on public.saved_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy generated_artifacts_select_own on public.generated_artifacts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy knowledge_jobs_select_own on public.knowledge_jobs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy expression_senses_select_own on public.expression_senses
  for select to authenticated using ((select auth.uid()) = user_id);

create policy expression_occurrences_select_own on public.expression_occurrences
  for select to authenticated using ((select auth.uid()) = user_id);

create policy user_expressions_select_own on public.user_expressions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy practice_tasks_select_own on public.practice_tasks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy attempts_select_own on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy mastery_events_select_own on public.mastery_events
  for select to authenticated using ((select auth.uid()) = user_id);

create policy review_tasks_select_own on public.review_tasks
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.knowledge_jobs is
  'Service-role workers bypass RLS but must still filter every read and mutation by the job user_id.';
