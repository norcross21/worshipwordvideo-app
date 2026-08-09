-- Replace the exposed SECURITY DEFINER directory RPC with RLS-protected rows
-- and a trigger-maintained playlist count. This keeps full playlist JSON private.

alter table public.app_users
  add column if not exists saved_playlist_count bigint not null default 0
  check (saved_playlist_count >= 0);

update public.app_users as members
set saved_playlist_count = (
  select count(*)
  from public.user_playlists as playlists
  where playlists.user_id = members.user_id
);

create or replace function private.sync_member_playlist_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
begin
  affected_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  update public.app_users
  set saved_playlist_count = (
    select count(*)
    from public.user_playlists
    where user_id = affected_user_id
  )
  where user_id = affected_user_id;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.app_users
    set saved_playlist_count = (
      select count(*)
      from public.user_playlists
      where user_id = old.user_id
    )
    where user_id = old.user_id;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.sync_member_playlist_count() from public, anon, authenticated;

drop trigger if exists sync_member_playlist_count on public.user_playlists;
create trigger sync_member_playlist_count
after insert or update of user_id or delete on public.user_playlists
for each row execute function private.sync_member_playlist_count();

drop policy if exists "Master administrators can read the account directory" on public.app_users;
drop policy if exists "Members can read their own profile" on public.app_users;

create policy "Members read own profile and administrators read directory"
on public.app_users
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
      and app_admins.role = 'master_admin'
  )
);

drop function if exists public.get_admin_member_directory();
