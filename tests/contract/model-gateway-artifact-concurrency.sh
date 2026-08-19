#!/usr/bin/env bash
set -euo pipefail

POPCORN_TEST_DATABASE_URL="${POPCORN_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
POPCORN_PSQL_BIN="${POPCORN_PSQL_BIN:-psql}"
POPCORN_ARTIFACT_LOCK_TMP="$(mktemp -d /tmp/popcorn-artifact-lock.XXXXXX)"
POPCORN_COMPLETE_LOG="$POPCORN_ARTIFACT_LOCK_TMP/complete-first.log"
POPCORN_REVOKE_LOG="$POPCORN_ARTIFACT_LOCK_TMP/revoke-first.log"
POPCORN_JOB_BLOCKER_LOG="$POPCORN_ARTIFACT_LOCK_TMP/job-blocker.log"

cleanup_artifact_lock_fixture() {
  "$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select pg_terminate_backend(pid)
from pg_catalog.pg_stat_activity
where application_name in (
  'popcorn_artifact_job_blocker',
  'popcorn_artifact_completion_probe'
)
  and pid <> pg_backend_pid();
do $$
declare
  v_secret_id uuid;
begin
  delete from public.generated_artifacts
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from public.knowledge_job_internal
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from private.learning_artifact_gateway_pins
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from public.knowledge_jobs
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from public.video_sources
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  for v_secret_id in
    select vault_secret_id
    from private.user_model_gateway_secrets
    where user_id in (
      '0a000000-0000-4000-8000-00000000a001',
      '0a000000-0000-4000-8000-00000000b002'
    )
  loop
    delete from private.user_model_gateway_secrets where vault_secret_id = v_secret_id;
    delete from vault.secrets where id = v_secret_id;
  end loop;
  delete from public.user_model_gateway_configs
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from public.model_gateway_origins
  where id = '8a000000-0000-4000-8000-000000000001';
  delete from public.profiles
  where user_id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
  delete from auth.users
  where id in (
    '0a000000-0000-4000-8000-00000000a001',
    '0a000000-0000-4000-8000-00000000b002'
  );
end
$$;
SQL
  rm -rf "$POPCORN_ARTIFACT_LOCK_TMP"
}

finish_artifact_lock_fixture() {
  local fixture_status="$?"
  trap - EXIT
  cleanup_artifact_lock_fixture
  exit "$fixture_status"
}

trap finish_artifact_lock_fixture EXIT
cleanup_artifact_lock_fixture
POPCORN_ARTIFACT_LOCK_TMP="$(mktemp -d /tmp/popcorn-artifact-lock.XXXXXX)"
POPCORN_COMPLETE_LOG="$POPCORN_ARTIFACT_LOCK_TMP/complete-first.log"
POPCORN_REVOKE_LOG="$POPCORN_ARTIFACT_LOCK_TMP/revoke-first.log"
POPCORN_JOB_BLOCKER_LOG="$POPCORN_ARTIFACT_LOCK_TMP/job-blocker.log"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000','0a000000-0000-4000-8000-00000000a001',
   'authenticated','authenticated','artifact-lock-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','0a000000-0000-4000-8000-00000000b002',
   'authenticated','authenticated','artifact-lock-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
insert into public.profiles(user_id) values
  ('0a000000-0000-4000-8000-00000000a001'),
  ('0a000000-0000-4000-8000-00000000b002');
insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values
  ('8a200000-0000-4000-8000-000000000001','0a000000-0000-4000-8000-00000000a001',
   'dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('8a200000-0000-4000-8000-000000000002','0a000000-0000-4000-8000-00000000b002',
   'M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE');
insert into public.model_gateway_origins(
  id,slug,display_name,canonical_origin,base_path,adapter_kind,state
) values (
  '8a000000-0000-4000-8000-000000000001','artifact-lock',
  'Artifact lock fixture','https://artifact-lock.example.com','/v1','openai-compatible','active'
);
select * from public.create_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000a001','8a100000-0000-4000-8000-000000000001',
  '8a000000-0000-4000-8000-000000000001','Complete first','provider/model-v1','secret-a',now()
);
select public.activate_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000a001','8a100000-0000-4000-8000-000000000001',
  'https://artifact-lock.example.com','model-egress-v1',now()
);
select * from public.create_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000b002','8a100000-0000-4000-8000-000000000002',
  '8a000000-0000-4000-8000-000000000001','Revoke first','provider/model-v1','secret-b',now()
);
select public.activate_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000b002','8a100000-0000-4000-8000-000000000002',
  'https://artifact-lock.example.com','model-egress-v1',now()
);
select * from public.register_gateway_learning_artifact_job(
  '0a000000-0000-4000-8000-00000000a001','8a200000-0000-4000-8000-000000000001',
  'generate_overview',repeat('a',64),'{"fixture":"complete-first"}',
  '8a100000-0000-4000-8000-000000000001',1,
  (select config_fingerprint from public.user_model_gateway_configs
   where id='8a100000-0000-4000-8000-000000000001'),now()
);
select * from public.register_gateway_learning_artifact_job(
  '0a000000-0000-4000-8000-00000000b002','8a200000-0000-4000-8000-000000000002',
  'generate_overview',repeat('b',64),'{"fixture":"revoke-first"}',
  '8a100000-0000-4000-8000-000000000002',1,
  (select config_fingerprint from public.user_model_gateway_configs
   where id='8a100000-0000-4000-8000-000000000002'),now()
);
update public.knowledge_jobs
set status='leased',attempt_count=1,lease_expires_at='2099-01-01 00:10:00+00'
where user_id in (
  '0a000000-0000-4000-8000-00000000a001',
  '0a000000-0000-4000-8000-00000000b002'
);
SQL

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$POPCORN_JOB_BLOCKER_LOG" 2>&1 <<'SQL' &
set application_name = 'popcorn_artifact_job_blocker';
begin;
select id from public.knowledge_jobs
where user_id='0a000000-0000-4000-8000-00000000a001'
for update;
select 'POPCORN_JOB_LOCK_HELD';
select pg_sleep(60);
commit;
SQL
POPCORN_JOB_BLOCKER_PID=$!

for _attempt in $(seq 1 100); do
  grep -q 'POPCORN_JOB_LOCK_HELD' "$POPCORN_JOB_BLOCKER_LOG" && break
  kill -0 "$POPCORN_JOB_BLOCKER_PID" 2>/dev/null || break
  sleep 0.05
done
grep -q 'POPCORN_JOB_LOCK_HELD' "$POPCORN_JOB_BLOCKER_LOG"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$POPCORN_COMPLETE_LOG" 2>&1 <<'SQL' &
set application_name = 'popcorn_artifact_completion_probe';
select public.complete_gateway_learning_artifact_job(
  '0a000000-0000-4000-8000-00000000a001',
  (select id from public.knowledge_jobs where user_id='0a000000-0000-4000-8000-00000000a001'),
  '8a200000-0000-4000-8000-000000000001','generate_overview','2099-01-01 00:10:00+00',1,
  'overview','{"summaryEnglish":"Complete wins","evidenceChinese":"先完成再撤销。"}',
  'overview-v1','provider/model-v1',repeat('a',64),
  '8a100000-0000-4000-8000-000000000001',1,
  (select config_fingerprint from public.user_model_gateway_configs
   where id='8a100000-0000-4000-8000-000000000001'),
  '2099-01-01 00:00:00+00'
);
SQL
POPCORN_COMPLETE_PID=$!

for _attempt in $(seq 1 100); do
  POPCORN_COMPLETION_WAITING="$("$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select exists (
  select 1
  from pg_catalog.pg_stat_activity
  where application_name = 'popcorn_artifact_completion_probe'
    and wait_event_type = 'Lock'
    and state = 'active'
);
SQL
)"
  [[ "$POPCORN_COMPLETION_WAITING" == "t" ]] && break
  kill -0 "$POPCORN_COMPLETE_PID" 2>/dev/null || break
  sleep 0.05
done
[[ "${POPCORN_COMPLETION_WAITING:-f}" == "t" ]]

if "$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
begin;
set local lock_timeout = '250ms';
update public.user_model_gateway_configs
set updated_at = updated_at
where id = '8a100000-0000-4000-8000-000000000001';
rollback;
SQL
then
  echo "completion released its config lock before publication" >&2
  exit 1
fi

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select pg_terminate_backend(pid)
from pg_catalog.pg_stat_activity
where application_name = 'popcorn_artifact_job_blocker';
SQL
wait "$POPCORN_JOB_BLOCKER_PID" || true
wait "$POPCORN_COMPLETE_PID"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select public.revoke_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000a001',
  '8a100000-0000-4000-8000-000000000001',now()
);
SQL

POPCORN_COMPLETE_WON="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select job.status='succeeded'
  and config.state='revoked'
  and count(artifact.id)=1
from public.knowledge_jobs as job
join public.user_model_gateway_configs as config on config.user_id=job.user_id
left join public.generated_artifacts as artifact
  on artifact.user_id=job.user_id and artifact.result_key=job.dedupe_key
where job.user_id='0a000000-0000-4000-8000-00000000a001'
group by job.status,config.state;
SQL
)"
[[ "$POPCORN_COMPLETE_WON" == "t" ]]

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$POPCORN_REVOKE_LOG" <<'SQL' &
begin;
select public.revoke_user_model_gateway_config(
  '0a000000-0000-4000-8000-00000000b002',
  '8a100000-0000-4000-8000-000000000002',now()
);
select 'POPCORN_REVOKE_LOCK_HELD';
select pg_sleep(2);
commit;
SQL
POPCORN_REVOKE_PID=$!

for _attempt in $(seq 1 100); do
  grep -q 'POPCORN_REVOKE_LOCK_HELD' "$POPCORN_REVOKE_LOG" && break
  kill -0 "$POPCORN_REVOKE_PID" 2>/dev/null || break
  sleep 0.05
done
grep -q 'POPCORN_REVOKE_LOCK_HELD' "$POPCORN_REVOKE_LOG"
POPCORN_REVOKE_WON="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
set statement_timeout = '10s';
select public.complete_gateway_learning_artifact_job(
  '0a000000-0000-4000-8000-00000000b002',
  (select id from public.knowledge_jobs where user_id='0a000000-0000-4000-8000-00000000b002'),
  '8a200000-0000-4000-8000-000000000002','generate_overview','2099-01-01 00:10:00+00',1,
  'overview','{"summaryEnglish":"Must not publish","evidenceChinese":"撤销后禁止发布。"}',
  'overview-v1','provider/model-v1',repeat('b',64),
  '8a100000-0000-4000-8000-000000000002',1,
  (select config_fingerprint from public.user_model_gateway_configs
   where id='8a100000-0000-4000-8000-000000000002'),
  '2099-01-01 00:00:00+00'
) is null;
SQL
)"
wait "$POPCORN_REVOKE_PID"
[[ "$POPCORN_REVOKE_WON" == "SET"$'\n'"t" || "$POPCORN_REVOKE_WON" == "t" ]]

POPCORN_REVOKE_STATE="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select job.status='terminal_failed'
  and internal.input='{}'::jsonb
  and count(artifact.id)=0
from public.knowledge_jobs as job
join public.knowledge_job_internal as internal on internal.knowledge_job_id=job.id
left join public.generated_artifacts as artifact
  on artifact.user_id=job.user_id and artifact.result_key=job.dedupe_key
where job.user_id='0a000000-0000-4000-8000-00000000b002'
group by job.status,internal.input;
SQL
)"
[[ "$POPCORN_REVOKE_STATE" == "t" ]]

echo "model gateway artifact lock invariant passed"
