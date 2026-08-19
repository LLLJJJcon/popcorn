#!/usr/bin/env bash
set -euo pipefail

POPCORN_TEST_DATABASE_URL="${POPCORN_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
POPCORN_PSQL_BIN="${POPCORN_PSQL_BIN:-psql}"
POPCORN_CONCURRENCY_TMP="$(mktemp -d /tmp/popcorn-gateway-concurrency.XXXXXX)"
POPCORN_ORIGIN_LOG="$POPCORN_CONCURRENCY_TMP/origin-update.log"

cleanup_gateway_fixture() {
  "$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$
declare
  v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from private.user_model_gateway_secrets
  where config_id = '83000000-0000-4000-8000-000000000001';
  delete from private.user_model_gateway_secrets
  where config_id = '83000000-0000-4000-8000-000000000001';
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
  delete from public.user_model_gateway_configs
  where id = '83000000-0000-4000-8000-000000000001';
  delete from public.model_gateway_origins
  where id = '82000000-0000-4000-8000-000000000001';
  delete from public.profiles
  where user_id = '00000000-0000-4000-8000-00000000c003';
  delete from auth.users
  where id = '00000000-0000-4000-8000-00000000c003';
end
$$;
SQL
  rm -rf "$POPCORN_CONCURRENCY_TMP"
}

trap cleanup_gateway_fixture EXIT
cleanup_gateway_fixture
POPCORN_CONCURRENCY_TMP="$(mktemp -d /tmp/popcorn-gateway-concurrency.XXXXXX)"
POPCORN_ORIGIN_LOG="$POPCORN_CONCURRENCY_TMP/origin-update.log"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000c003',
  'authenticated', 'authenticated', 'gateway-lock@popcorn.test',
  crypt('password-c', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.profiles (user_id)
values ('00000000-0000-4000-8000-00000000c003');
insert into public.model_gateway_origins (
  id, slug, display_name, canonical_origin, base_path, adapter_kind, state
) values (
  '82000000-0000-4000-8000-000000000001', 'concurrency-gateway',
  'Concurrency gateway', 'https://concurrency.example.com', '/v1',
  'openai-compatible', 'active'
);
SQL

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >"$POPCORN_ORIGIN_LOG" <<'SQL' &
begin;
update public.model_gateway_origins
set base_path = '/v2', updated_at = '2026-08-19 11:00:00+00'
where id = '82000000-0000-4000-8000-000000000001';
select 'POPCORN_ORIGIN_UPDATED';
select pg_sleep(2);
commit;
SQL
POPCORN_ORIGIN_PID=$!

for _attempt in $(seq 1 100); do
  if grep -q 'POPCORN_ORIGIN_UPDATED' "$POPCORN_ORIGIN_LOG"; then
    break
  fi
  if ! kill -0 "$POPCORN_ORIGIN_PID" 2>/dev/null; then
    break
  fi
  sleep 0.05
done
grep -q 'POPCORN_ORIGIN_UPDATED' "$POPCORN_ORIGIN_LOG"

"$POPCORN_PSQL_BIN" "$POPCORN_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
select * from public.create_user_model_gateway_config(
  '00000000-0000-4000-8000-00000000c003',
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'Concurrent config', 'provider/model-v1', 'concurrency-secret',
  '2026-08-19 11:00:01+00'
);
SQL
wait "$POPCORN_ORIGIN_PID"

POPCORN_FINGERPRINT_MATCH="$($POPCORN_PSQL_BIN "$POPCORN_TEST_DATABASE_URL" -X -At -v ON_ERROR_STOP=1 <<'SQL'
select config.config_fingerprint = encode(extensions.digest(
  'adapter:' || octet_length(origin.adapter_kind)::text || ':' || origin.adapter_kind
    || '|origin:' || octet_length(origin.canonical_origin)::text || ':' || origin.canonical_origin
    || '|path:' || octet_length(origin.base_path)::text || ':' || origin.base_path
    || '|model:' || octet_length(config.model)::text || ':' || config.model,
  'sha256'
), 'hex')
from public.user_model_gateway_configs as config
join public.model_gateway_origins as origin on origin.id = config.origin_id
where config.id = '83000000-0000-4000-8000-000000000001';
SQL
)"

if [[ "$POPCORN_FINGERPRINT_MATCH" != "t" ]]; then
  echo "model gateway concurrency invariant failed" >&2
  exit 1
fi

echo "model gateway concurrency invariant passed"
