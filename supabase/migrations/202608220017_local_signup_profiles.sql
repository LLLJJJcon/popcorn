create function private.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_created_at timestamptz := coalesce(new.created_at, statement_timestamp());
begin
  insert into public.profiles (user_id, created_at, updated_at)
  values (new.id, v_created_at, v_created_at)
  on conflict (user_id) do nothing;

  return new;
end
$$;

revoke all on function private.create_profile_for_new_auth_user()
  from public, anon, authenticated, service_role;

create constraint trigger popcorn_create_profile_after_auth_user
after insert on auth.users
deferrable initially deferred
for each row execute function private.create_profile_for_new_auth_user();

comment on function private.create_profile_for_new_auth_user()
  is 'Creates the fixed English-to-Mandarin Popcorn profile in the same committed transaction as a new auth user.';

insert into public.profiles (user_id, created_at, updated_at)
select
  account.id,
  coalesce(account.created_at, statement_timestamp()),
  coalesce(account.created_at, statement_timestamp())
from auth.users as account
where not exists (
  select 1 from public.profiles as profile where profile.user_id = account.id
)
on conflict (user_id) do nothing;
