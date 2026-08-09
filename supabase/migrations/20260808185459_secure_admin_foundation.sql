create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.admin_email_allowlist (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('master_admin'))
);

insert into private.admin_email_allowlist (email, role)
values ('stephen@kairoshousing.org.uk', 'master_admin');

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('master_admin')),
  granted_at timestamptz not null default now()
);

comment on table public.app_admins is
  'Application administrator assignments. Signed-in users may only read their own assignment.';

alter table public.app_admins enable row level security;

create policy "Users can read their own administrator role"
on public.app_admins
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.app_admins from public, anon;
grant select on table public.app_admins to authenticated;

create table public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
);

comment on table public.app_users is
  'Minimal account directory for the in-app administrator dashboard. Passwords and authentication secrets are never copied.';

alter table public.app_users enable row level security;

create policy "Master administrators can read the account directory"
on public.app_users
for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
      and app_admins.role = 'master_admin'
  )
);

revoke all on table public.app_users from public, anon;
grant select on table public.app_users to authenticated;

create or replace function private.sync_app_user_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.app_users where user_id = old.id;
    return old;
  end if;

  insert into public.app_users (
    user_id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
  )
  values (
    new.id,
    lower(new.email),
    new.created_at,
    new.email_confirmed_at,
    new.last_sign_in_at
  )
  on conflict (user_id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      last_sign_in_at = excluded.last_sign_in_at;

  delete from public.app_admins
  where user_id = new.id
    and (
      new.email_confirmed_at is null
      or not exists (
        select 1
        from private.admin_email_allowlist as allowlist
        where allowlist.email = lower(new.email)
      )
    );

  -- A role is granted only after Supabase has verified ownership of an exact
  -- allowlisted email address. This never trusts browser-supplied metadata.
  if new.email_confirmed_at is not null then
    insert into public.app_admins (user_id, role)
    select new.id, allowlist.role
    from private.admin_email_allowlist as allowlist
    where allowlist.email = lower(new.email)
    on conflict (user_id) do update
    set role = excluded.role;
  end if;

  return new;
end;
$$;

revoke execute on function private.sync_app_user_directory() from public, anon, authenticated;

create trigger sync_app_user_directory_after_auth_change
after insert or update of email, email_confirmed_at, last_sign_in_at or delete
on auth.users
for each row execute function private.sync_app_user_directory();

insert into public.app_users (user_id, email, created_at, email_confirmed_at, last_sign_in_at)
select id, lower(email), created_at, email_confirmed_at, last_sign_in_at
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at;

insert into public.app_admins (user_id, role)
select users.id, allowlist.role
from auth.users as users
join private.admin_email_allowlist as allowlist
  on allowlist.email = lower(users.email)
where users.email_confirmed_at is not null
on conflict (user_id) do update
set role = excluded.role;
