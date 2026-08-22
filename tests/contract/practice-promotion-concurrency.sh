#!/usr/bin/env bash
set -euo pipefail

POPCORN_TEST_DATABASE_URL="${POPCORN_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
POPCORN_PSQL_BIN="${POPCORN_PSQL_BIN:-psql}"
POPCORN_PROMOTION_TMP="$(mktemp -d /tmp/popcorn-practice-promotion.XXXXXX)"
POPCORN_GATE_LOG="$POPCORN_PROMOTION_TMP/gate.log"
POPCORN_FIRST_LOG="$POPCORN_PROMOTION_TMP/first.log"
POPCORN_SECOND_LOG="$POPCORN_PROMOTION_TMP/second.log"

cleanup_promotion_fixture() {
  "$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select pg_terminate_backend(pid)
from pg_catalog.pg_stat_activity
where application_name in (
  'popcorn_practice_promotion_gate',
  'popcorn_practice_promotion_first',
  'popcorn_practice_promotion_second'
)
  and pid <> pg_backend_pid();
delete from private.practice_promotion_receipts
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.review_tasks
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.mastery_events
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.attempts
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.practice_tasks
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.user_expressions
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.expression_occurrences
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.expression_senses
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.practice_draft_attempts
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.practice_drafts
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.generated_artifacts
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.saved_items
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.transcript_segments
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.video_snapshots
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.video_sources
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from public.profiles
where user_id='0d000000-0000-4000-8000-00000000a001';
delete from auth.users
where id='0d000000-0000-4000-8000-00000000a001';
SQL
  rm -rf "$POPCORN_PROMOTION_TMP"
}

finish_promotion_fixture() {
  local fixture_status="$?"
  trap - EXIT
  cleanup_promotion_fixture
  exit "$fixture_status"
}

trap finish_promotion_fixture EXIT
cleanup_promotion_fixture
POPCORN_PROMOTION_TMP="$(mktemp -d /tmp/popcorn-practice-promotion.XXXXXX)"
POPCORN_GATE_LOG="$POPCORN_PROMOTION_TMP/gate.log"
POPCORN_FIRST_LOG="$POPCORN_PROMOTION_TMP/first.log"
POPCORN_SECOND_LOG="$POPCORN_PROMOTION_TMP/second.log"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000','0d000000-0000-4000-8000-00000000a001',
  'authenticated','authenticated','promotion-lock@popcorn.test',
  crypt('password-a',gen_salt('bf')),now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
);
insert into public.profiles(user_id)
values ('0d000000-0000-4000-8000-00000000a001')
on conflict (user_id) do nothing;
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values (
  '0d100000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  'dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);
insert into public.video_snapshots(
  id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
  description,transcript_language,transcript_hash,captured_at
) values (
  '0d200000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d100000-0000-4000-8000-000000000001','Concurrency fixture','Popcorn',
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',120,'Fixture','zh-CN',repeat('d',64),
  '2026-08-20 12:00:00+00'
);
insert into public.transcript_segments(
  id,user_id,snapshot_id,stable_id,position,original_chinese,english_translation,
  start_seconds,end_seconds,language
) values (
  '0d300000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d200000-0000-4000-8000-000000000001','seg-concurrency',0,'这也太离谱了吧。',
  'This is outrageous.',10,12,'zh-CN'
);
insert into public.saved_items(
  id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,
  captured_at,start_seconds,payload
) values (
  '0d400000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d100000-0000-4000-8000-000000000001','0d200000-0000-4000-8000-000000000001',
  '0de00000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row','ready',
  '2026-08-20 12:00:00+00',10,
  '{"segmentId":"seg-concurrency","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb
);
insert into public.generated_artifacts(
  id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,
  content,prompt_version,model,result_key,created_at
) values (
  '0d500000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d100000-0000-4000-8000-000000000001','0d400000-0000-4000-8000-000000000001',
  'saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了","englishMeaning":"outrageous","englishExplanation":"Used when something feels unreasonable.","tone":"surprised","communicativeFunction":"reacting to an unreasonable event","register":"informal","evidenceText":"这也太离谱了吧。","segmentIds":["seg-concurrency"],"startSeconds":10,"endSeconds":12,"confidence":0.96}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('e',64),'2026-08-20 12:01:00+00'
);
insert into public.practice_drafts(
  id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
  future_user_expression_id,native_language,target_language,target_expression,
  prompt_chinese,instructions_english,goal_english,status,created_at,updated_at
) values (
  '0d600000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d100000-0000-4000-8000-000000000001','0d400000-0000-4000-8000-000000000001',
  '0d500000-0000-4000-8000-000000000001',0,'0d700000-0000-4000-8000-000000000001',
  'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
  'Use the target expression.','active','2026-08-20 12:02:00+00','2026-08-20 12:02:00+00'
);
insert into public.practice_draft_attempts(
  id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
  passed,accuracy_score,accuracy_feedback_english,naturalness_score,
  naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
  independent_use,assistance_level,submitted_at,created_at
) values (
  '0d800000-0000-4000-8000-000000000001','0d000000-0000-4000-8000-00000000a001',
  '0d600000-0000-4000-8000-000000000001','0d700000-0000-4000-8000-000000000001',
  1,'这也太离谱了吧。',true,5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',
  true,'none','2026-08-20 12:03:00+00','2026-08-20 12:03:01+00'
);
SQL

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 >"$POPCORN_GATE_LOG" 2>&1 <<'SQL' &
set application_name = 'popcorn_practice_promotion_gate';
select pg_advisory_lock(202608160012);
select 'GATE_READY';
select pg_sleep(60);
SQL
POPCORN_GATE_PID=$!

for _attempt in $(seq 1 100); do
  grep -q 'GATE_READY' "$POPCORN_GATE_LOG" && break
  kill -0 "$POPCORN_GATE_PID" 2>/dev/null || break
  sleep 0.05
done
grep -q 'GATE_READY' "$POPCORN_GATE_LOG"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 >"$POPCORN_FIRST_LOG" 2>&1 <<'SQL' &
set application_name = 'popcorn_practice_promotion_first';
begin;
set local role service_role;
select 'FIRST|' || concat_ws('|',expression_sense_id,occurrence_id,user_expression_id,
  practice_task_id,attempt_id,mastery_event_id,review_task_id,created)
from public.promote_valid_practice_draft_attempt(
  '0d000000-0000-4000-8000-00000000a001','0d800000-0000-4000-8000-000000000001',
  '太离谱了','2026-08-21 12:03:00+00',1
);
select pg_advisory_lock(202608160012);
select pg_advisory_unlock(202608160012);
commit;
SQL
POPCORN_FIRST_PID=$!

for _attempt in $(seq 1 100); do
  POPCORN_FIRST_WAITING="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select exists (
  select 1 from pg_catalog.pg_stat_activity
  where application_name='popcorn_practice_promotion_first'
    and state='active' and wait_event_type='Lock'
);
SQL
)"
  [[ "$POPCORN_FIRST_WAITING" == "t" ]] && break
  kill -0 "$POPCORN_FIRST_PID" 2>/dev/null || break
  sleep 0.05
done
[[ "${POPCORN_FIRST_WAITING:-f}" == "t" ]]

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 >"$POPCORN_SECOND_LOG" 2>&1 <<'SQL' &
set application_name = 'popcorn_practice_promotion_second';
begin;
set local role service_role;
select 'SECOND|' || concat_ws('|',expression_sense_id,occurrence_id,user_expression_id,
  practice_task_id,attempt_id,mastery_event_id,review_task_id,created)
from public.promote_valid_practice_draft_attempt(
  '0d000000-0000-4000-8000-00000000a001','0d800000-0000-4000-8000-000000000001',
  '太离谱了','2026-08-21 12:03:00+00',1
);
commit;
SQL
POPCORN_SECOND_PID=$!

for _attempt in $(seq 1 100); do
  POPCORN_SECOND_WAITING="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select exists (
  select 1 from pg_catalog.pg_stat_activity
  where application_name='popcorn_practice_promotion_second'
    and state='active' and wait_event_type='Lock'
);
SQL
)"
  [[ "$POPCORN_SECOND_WAITING" == "t" ]] && break
  kill -0 "$POPCORN_SECOND_PID" 2>/dev/null || break
  sleep 0.05
done
[[ "${POPCORN_SECOND_WAITING:-f}" == "t" ]]

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select pg_terminate_backend(pid)
from pg_catalog.pg_stat_activity
where application_name='popcorn_practice_promotion_gate';
SQL
wait "$POPCORN_GATE_PID" || true
wait "$POPCORN_FIRST_PID"
wait "$POPCORN_SECOND_PID"

POPCORN_FIRST_RESULT="$(grep '^FIRST|' "$POPCORN_FIRST_LOG")"
POPCORN_SECOND_RESULT="$(grep '^SECOND|' "$POPCORN_SECOND_LOG")"
POPCORN_FIRST_PAYLOAD="${POPCORN_FIRST_RESULT#FIRST|}"
POPCORN_SECOND_PAYLOAD="${POPCORN_SECOND_RESULT#SECOND|}"
POPCORN_FIRST_IDS="${POPCORN_FIRST_PAYLOAD%|*}"
POPCORN_SECOND_IDS="${POPCORN_SECOND_PAYLOAD%|*}"
[[ "${POPCORN_FIRST_PAYLOAD##*|}" == "t" ]]
[[ "${POPCORN_SECOND_PAYLOAD##*|}" == "f" ]]
[[ "$POPCORN_FIRST_IDS" == "$POPCORN_SECOND_IDS" ]]

POPCORN_GRAPH_STATE="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -F '|' -v ON_ERROR_STOP=1 <<'SQL'
select
  (select count(*) from public.expression_senses where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.expression_occurrences where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.user_expressions where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.practice_tasks where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.attempts where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.mastery_events where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from public.review_tasks where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select count(*) from private.practice_promotion_receipts where user_id='0d000000-0000-4000-8000-00000000a001'),
  (select status from public.practice_drafts where id='0d600000-0000-4000-8000-000000000001'),
  (select revision::text || ':' || passed::text || ':' || response_chinese
   from public.practice_draft_attempts where id='0d800000-0000-4000-8000-000000000001');
SQL
)"
[[ "$POPCORN_GRAPH_STATE" == '1|1|1|1|1|1|1|1|completed|1:true:这也太离谱了吧。' ]]

echo "practice promotion concurrency invariant passed"
