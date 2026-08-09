-- Member profiles, consent records, richer saved services and a bounded admin directory.

alter table public.app_users
  add column if not exists display_name text,
  add column if not exists church_name text,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists account_emails_acknowledged_at timestamptz,
  add column if not exists kairos_marketing_opt_in boolean not null default false,
  add column if not exists kairos_marketing_opt_in_at timestamptz,
  add column if not exists kairos_marketing_opt_out_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_display_name_length_check'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_display_name_length_check
      check (display_name is null or char_length(btrim(display_name)) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_church_name_length_check'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_church_name_length_check
      check (church_name is null or char_length(btrim(church_name)) between 1 and 120);
  end if;
end
$$;

drop policy if exists "Members can read their own profile" on public.app_users;
create policy "Members can read their own profile"
on public.app_users
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Members can update their own profile" on public.app_users;
create policy "Members can update their own profile"
on public.app_users
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke update on table public.app_users from authenticated;
grant update (
  display_name,
  church_name,
  terms_version,
  terms_accepted_at,
  account_emails_acknowledged_at,
  kairos_marketing_opt_in,
  kairos_marketing_opt_in_at,
  kairos_marketing_opt_out_at
) on public.app_users to authenticated;

alter table public.user_playlists
  add column if not exists service_date date,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_playlists_notes_length_check'
      and conrelid = 'public.user_playlists'::regclass
  ) then
    alter table public.user_playlists
      add constraint user_playlists_notes_length_check
      check (notes is null or char_length(notes) <= 500);
  end if;
end
$$;

create or replace function private.touch_user_playlist_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.touch_user_playlist_updated_at() from public, anon, authenticated;

drop trigger if exists touch_user_playlist_updated_at on public.user_playlists;
create trigger touch_user_playlist_updated_at
before update on public.user_playlists
for each row execute function private.touch_user_playlist_updated_at();

create or replace function private.sync_app_user_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_terms boolean;
  accepted_account_emails boolean;
  accepted_kairos_marketing boolean;
begin
  if tg_op = 'DELETE' then
    delete from public.app_users where user_id = old.id;
    return old;
  end if;

  accepted_terms := coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') = 'true';
  accepted_account_emails := coalesce(new.raw_user_meta_data ->> 'account_emails_acknowledged', '') = 'true';
  accepted_kairos_marketing := coalesce(new.raw_user_meta_data ->> 'kairos_marketing_opt_in', '') = 'true';

  insert into public.app_users (
    user_id,
    email,
    display_name,
    church_name,
    created_at,
    email_confirmed_at,
    last_sign_in_at,
    terms_version,
    terms_accepted_at,
    account_emails_acknowledged_at,
    kairos_marketing_opt_in,
    kairos_marketing_opt_in_at
  )
  values (
    new.id,
    lower(new.email),
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'church_name'), ''),
    new.created_at,
    new.email_confirmed_at,
    new.last_sign_in_at,
    case when accepted_terms then coalesce(new.raw_user_meta_data ->> 'terms_version', '2026-08-09') end,
    case when accepted_terms then now() end,
    case when accepted_account_emails then now() end,
    accepted_kairos_marketing,
    case when accepted_kairos_marketing then now() end
  )
  on conflict (user_id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      last_sign_in_at = excluded.last_sign_in_at,
      display_name = coalesce(public.app_users.display_name, excluded.display_name),
      church_name = coalesce(public.app_users.church_name, excluded.church_name),
      terms_version = coalesce(public.app_users.terms_version, excluded.terms_version),
      terms_accepted_at = coalesce(public.app_users.terms_accepted_at, excluded.terms_accepted_at),
      account_emails_acknowledged_at = coalesce(public.app_users.account_emails_acknowledged_at, excluded.account_emails_acknowledged_at);

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

update public.app_users as directory
set display_name = coalesce(directory.display_name, nullif(btrim(users.raw_user_meta_data ->> 'display_name'), '')),
    church_name = coalesce(directory.church_name, nullif(btrim(users.raw_user_meta_data ->> 'church_name'), '')),
    terms_version = case
      when directory.terms_accepted_at is not null then directory.terms_version
      when coalesce(users.raw_user_meta_data ->> 'terms_accepted', '') = 'true' then coalesce(users.raw_user_meta_data ->> 'terms_version', '2026-08-09')
      else directory.terms_version
    end,
    terms_accepted_at = case
      when directory.terms_accepted_at is not null then directory.terms_accepted_at
      when coalesce(users.raw_user_meta_data ->> 'terms_accepted', '') = 'true' then now()
      else null
    end,
    account_emails_acknowledged_at = case
      when directory.account_emails_acknowledged_at is not null then directory.account_emails_acknowledged_at
      when coalesce(users.raw_user_meta_data ->> 'account_emails_acknowledged', '') = 'true' then now()
      else null
    end
from auth.users as users
where users.id = directory.user_id;

create or replace function public.get_admin_member_directory()
returns table (
  user_id uuid,
  email text,
  display_name text,
  church_name text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  terms_accepted_at timestamptz,
  kairos_marketing_opt_in boolean,
  kairos_marketing_opt_in_at timestamptz,
  playlist_count bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
      and app_admins.role = 'master_admin'
  ) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  return query
  select
    members.user_id,
    members.email,
    members.display_name,
    members.church_name,
    members.created_at,
    members.email_confirmed_at,
    members.last_sign_in_at,
    members.terms_accepted_at,
    members.kairos_marketing_opt_in,
    members.kairos_marketing_opt_in_at,
    count(playlists.id)::bigint as playlist_count
  from public.app_users as members
  left join public.user_playlists as playlists on playlists.user_id = members.user_id
  group by members.user_id
  order by members.created_at desc;
end;
$$;

revoke all on function public.get_admin_member_directory() from public, anon;
grant execute on function public.get_admin_member_directory() to authenticated;

comment on function public.get_admin_member_directory() is
  'Returns the bounded member-management directory only to verified master administrators.';
